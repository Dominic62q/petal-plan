import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { DateTime } from "luxon";
import webpush from "web-push";
const REGION = "us-central1";
const DATABASE_ID = "petal-db";
const VAPID_SUBJECT = defineSecret("VAPID_SUBJECT");
const VAPID_PUBLIC_KEY = defineSecret("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = defineSecret("VAPID_PRIVATE_KEY");
initializeApp();
const db = getFirestore(DATABASE_ID);
function reminderDate(item) {
    const date = item.date ?? item.dueDate;
    const time = item.time ?? item.dueTime;
    if (!date || !time || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time))
        return null;
    return { date, time };
}
function scheduledFor(item) {
    const when = reminderDate(item);
    const offset = item.reminderOffsetMinutes;
    if (!when || !item.timeZone || offset === undefined || !Number.isInteger(offset) || offset < 0)
        return null;
    const local = DateTime.fromISO(`${when.date}T${when.time}`, { zone: item.timeZone });
    if (!local.isValid)
        return null;
    const scheduled = local.minus({ minutes: offset });
    return scheduled.toJSDate() > new Date() ? scheduled.toJSDate() : null;
}
function configureWebPush() {
    webpush.setVapidDetails(VAPID_SUBJECT.value(), VAPID_PUBLIC_KEY.value(), VAPID_PRIVATE_KEY.value());
}
async function syncReminderJob({ jobId, item, ownerUid, itemType, itemId, eventId, url, }) {
    const jobReference = db.collection("reminderJobs").doc(jobId);
    const dateTime = item ? reminderDate(item) : null;
    const deliveryTime = item && !item.done ? scheduledFor(item) : null;
    if (!item || !ownerUid || !dateTime || !deliveryTime) {
        await jobReference.delete();
        return;
    }
    await jobReference.set({
        ownerUid,
        itemType,
        itemId,
        ...(eventId ? { eventId } : {}),
        title: item.title?.trim() || "Untitled reminder",
        date: dateTime.date,
        time: dateTime.time,
        scheduledFor: Timestamp.fromDate(deliveryTime),
        status: "pending",
        url,
    });
}
export const syncEventReminder = onDocumentWritten({ document: "events/{eventId}", database: DATABASE_ID, region: REGION }, async (event) => {
    const item = event.data?.after.exists
        ? event.data.after.data()
        : undefined;
    await syncReminderJob({
        jobId: `event-${event.params.eventId}`,
        item,
        ownerUid: item?.ownerUid,
        itemType: "event",
        itemId: event.params.eventId,
        url: `/calendar?date=${item?.date ?? ""}&event=${event.params.eventId}`,
    });
});
export const syncEventTaskReminder = onDocumentWritten({ document: "events/{eventId}/tasks/{taskId}", database: DATABASE_ID, region: REGION }, async (event) => {
    const item = event.data?.after.exists ? event.data.after.data() : undefined;
    const eventSnapshot = await db.collection("events").doc(event.params.eventId).get();
    const ownerUid = eventSnapshot.exists ? eventSnapshot.get("ownerUid") : undefined;
    await syncReminderJob({
        jobId: `event-task-${event.params.eventId}-${event.params.taskId}`,
        item,
        ownerUid,
        itemType: "event-task",
        itemId: event.params.taskId,
        eventId: event.params.eventId,
        url: `/tasks?focusTask=${event.params.taskId}&event=${event.params.eventId}`,
    });
});
export const syncPersonalTaskReminder = onDocumentWritten({ document: "users/{uid}/standalone_tasks/{taskId}", database: DATABASE_ID, region: REGION }, async (event) => {
    const item = event.data?.after.exists ? event.data.after.data() : undefined;
    await syncReminderJob({
        jobId: `personal-task-${event.params.uid}-${event.params.taskId}`,
        item,
        ownerUid: event.params.uid,
        itemType: "personal-task",
        itemId: event.params.taskId,
        url: `/tasks?focusTask=${event.params.taskId}`,
    });
});
async function sendToUser(ownerUid, payload) {
    configureWebPush();
    const subscriptions = await db.collection("users").doc(ownerUid).collection("pushSubscriptions").get();
    let delivered = 0;
    await Promise.all(subscriptions.docs.map(async (subscription) => {
        const data = subscription.data();
        try {
            await webpush.sendNotification(data, JSON.stringify(payload));
            delivered += 1;
        }
        catch (error) {
            const statusCode = typeof error === "object" && error !== null && "statusCode" in error
                ? Number(error.statusCode)
                : 0;
            if (statusCode === 404 || statusCode === 410)
                await subscription.ref.delete();
            else
                logger.error("Unable to send push notification", { ownerUid, subscriptionId: subscription.id, error });
        }
    }));
    return delivered;
}
export const dispatchDueReminders = onSchedule({
    schedule: "every 1 minutes",
    timeZone: "Etc/UTC",
    region: REGION,
    secrets: [VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY],
}, async () => {
    const now = Timestamp.now();
    const dueJobs = await db.collection("reminderJobs")
        .where("status", "==", "pending")
        .where("scheduledFor", "<=", now)
        .orderBy("scheduledFor")
        .limit(50)
        .get();
    await Promise.all(dueJobs.docs.map(async (candidate) => {
        const claimed = await db.runTransaction(async (transaction) => {
            const current = await transaction.get(candidate.ref);
            const job = current.data();
            if (!current.exists || job?.status !== "pending" || job.scheduledFor.toMillis() > now.toMillis())
                return null;
            transaction.update(candidate.ref, { status: "sending", claimedAt: Timestamp.now() });
            return job;
        });
        if (!claimed)
            return;
        try {
            const delivered = await sendToUser(claimed.ownerUid, {
                title: claimed.title,
                body: `${claimed.itemType === "event" ? "Event" : "Task"} reminder · ${claimed.date} at ${claimed.time}`,
                tag: `reminder-${candidate.id}`,
                url: claimed.url,
            });
            await candidate.ref.update({ status: "sent", sentAt: Timestamp.now(), delivered });
        }
        catch (error) {
            logger.error("Reminder delivery failed", { jobId: candidate.id, error });
            await candidate.ref.update({ status: "failed", failedAt: Timestamp.now() });
        }
    }));
});
export const sendTestReminder = onCall({ region: REGION, secrets: [VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY] }, async (request) => {
    if (!request.auth)
        throw new HttpsError("unauthenticated", "Sign in before testing notifications.");
    const delivered = await sendToUser(request.auth.uid, {
        title: "Petal & Plan",
        body: "Notifications are ready on this device.",
        tag: "petal-plan-test",
        url: "/profile",
    });
    return { delivered };
});
