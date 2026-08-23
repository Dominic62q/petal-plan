import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Legacy category fields remain readable for older event documents. */
/** Legacy category values retained for older user profile documents. */
export const BUILT_IN_CATEGORIES = ["wedding", "corporate", "birthday", "gala"] as const;
export type BuiltInCategory = (typeof BUILT_IN_CATEGORIES)[number];
export type EventCategory = string;
export type TaskPriority = "high" | "medium" | "low";
export type ScheduleKind = "appointment" | "slot";

export interface PlannerEvent {
  id: string;
  ownerUid: string;
  title: string;
  /** Optional legacy field; new events do not write categories. */
  category?: EventCategory;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  timeZone?: string; // IANA zone, such as Africa/Accra
  reminderOffsetMinutes?: number;
  status: "planning" | "confirmed";
  createdAt?: Timestamp;
}

export interface EventTask {
  id: string;
  eventId: string;
  title: string;
  group: string;
  priority: TaskPriority;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  timeZone?: string; // IANA zone, such as Africa/Accra
  reminderOffsetMinutes?: number;
  done: boolean;
}

export interface ScheduleEntry {
  id: string;
  eventId: string;
  title: string;
  kind: ScheduleKind;
  date: string; // YYYY-MM-DD — the day this entry happens
  startAt: string; // HH:mm
  endAt: string; // HH:mm
  location: string;
}

const eventsCollection = () => collection(db!, "events");

const tasksCollection = (eventId: string) =>
  collection(db!, "events", eventId, "tasks");

const scheduleCollection = (eventId: string) =>
  collection(db!, "events", eventId, "schedule");

function requireDb() {
  if (!db) throw new Error("Firebase is not configured");
}

// ---------------------------------------------------------------------------
// User profile + custom categories
// ---------------------------------------------------------------------------

export interface UserProfile {
  displayName?: string;
  createdAt?: string;
  /** User-created category slugs (built-ins live in BUILT_IN_CATEGORIES). */
  categories?: string[];
}

export async function getUserProfile(uid: string): Promise<UserProfile> {
  requireDb();
  const snapshot = await getDoc(doc(db!, "users", uid));
  if (!snapshot.exists()) return {};
  return snapshot.data() as UserProfile;
}

/** Slugify a free-text category into a stable id. */
export function slugifyCategory(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Adds a custom category to the user's profile. Idempotent; returns the
 * full list including built-ins.
 */
export async function addCustomCategory(
  uid: string,
  name: string,
): Promise<string[]> {
  requireDb();
  const slug = slugifyCategory(name);
  if (!slug) throw new Error("Category needs a usable name.");
  const profile = await getUserProfile(uid);
  const existing = new Set([
    ...BUILT_IN_CATEGORIES,
    ...(profile.categories ?? []),
  ]);
  if (existing.has(slug)) {
    return [...BUILT_IN_CATEGORIES, ...(profile.categories ?? [])];
  }
  const categories = [...(profile.categories ?? []), slug];
  // Only carry displayName through if we actually have it — a merge with
  // `null` would wipe a name that a concurrent write had just set.
  const update: Record<string, unknown> = { categories };
  if (profile.displayName) update.displayName = profile.displayName;
  await setDoc(doc(db!, "users", uid), update, { merge: true });
  return [...BUILT_IN_CATEGORIES, ...categories];
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function listEvents(ownerUid: string): Promise<PlannerEvent[]> {
  requireDb();
  const snapshot = await getDocs(
    query(eventsCollection(), where("ownerUid", "==", ownerUid)),
  );
  return snapshot.docs.map((entry) => ({
    ...(entry.data() as Omit<PlannerEvent, "id">),
    id: entry.id,
  }));
}

export async function createEvent(
  ownerUid: string,
  input: Pick<
    PlannerEvent,
    "title" | "date" | "time" | "timeZone" | "reminderOffsetMinutes"
  > & {
    status?: PlannerEvent["status"];
  },
): Promise<string> {
  requireDb();
  const eventReference = await addDoc(eventsCollection(), {
    ...input,
    status: input.status ?? "planning",
    ownerUid,
    createdAt: serverTimestamp(),
  });
  return eventReference.id;
}

/**
 * Starter checklists — explicit templates reserved for a future opt-in setup
 * action. Creating an event does not seed tasks automatically.
 */
export const STARTER_CHECKLISTS: Record<
  string,
  Array<{ title: string; group: string; priority: TaskPriority }>
> = {
  wedding: [
    { title: "Book the venue", group: "Venue", priority: "high" },
    { title: "Confirm catering", group: "Catering", priority: "high" },
    { title: "Send save-the-dates", group: "Guests", priority: "medium" },
    { title: "Finalise guest list", group: "Guests", priority: "medium" },
  ],
  corporate: [
    { title: "Lock the agenda", group: "Programme", priority: "high" },
    { title: "Arrange AV + tech run", group: "Production", priority: "high" },
    { title: "Send invites", group: "Guests", priority: "medium" },
  ],
  birthday: [
    { title: "Order the cake", group: "Food", priority: "high" },
    { title: "Send invitations", group: "Guests", priority: "medium" },
    { title: "Plan activities", group: "Fun", priority: "low" },
  ],
  gala: [
    { title: "Secure venue & permits", group: "Logistics", priority: "high" },
    { title: "Confirm sponsors", group: "Partners", priority: "high" },
    { title: "Brief the run sheet", group: "Production", priority: "medium" },
  ],
  _default: [
    { title: "Draft the plan", group: "Planning", priority: "medium" },
    { title: "Confirm the essentials", group: "Logistics", priority: "high" },
    { title: "Share with your group", group: "People", priority: "low" },
  ],
};


export async function getEvent(eventId: string): Promise<PlannerEvent | null> {
  requireDb();
  const snapshot = await getDoc(doc(db!, "events", eventId));
  if (!snapshot.exists()) return null;
  return {
    ...(snapshot.data() as Omit<PlannerEvent, "id">),
    id: snapshot.id,
  };
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export async function listTasks(eventId: string): Promise<EventTask[]> {
  requireDb();
  const snapshot = await getDocs(tasksCollection(eventId));
  return snapshot.docs.map((entry) => ({
    ...(entry.data() as Omit<EventTask, "id">),
    id: entry.id,
    eventId,
  }));
}

export async function createTask(
  eventId: string,
  input: Omit<EventTask, "id" | "eventId" | "done">,
): Promise<string> {
  requireDb();
  const reference = await addDoc(tasksCollection(eventId), {
    ...input,
    done: false,
  });
  return reference.id;
}

export async function setTaskDone(
  eventId: string,
  taskId: string,
  done: boolean,
): Promise<void> {
  requireDb();
  await updateDoc(doc(db!, "events", eventId, "tasks", taskId), { done });
}

export async function deleteTask(
  eventId: string,
  taskId: string,
): Promise<void> {
  requireDb();
  await deleteDoc(doc(db!, "events", eventId, "tasks", taskId));
}

// ---------------------------------------------------------------------------
// Standalone tasks — not attached to any event. Stored flat under
// users/{uid}/standalone_tasks so rules stay owner-only and queries are cheap.
// ---------------------------------------------------------------------------

export interface StandaloneTask {
  id: string;
  title: string;
  dueDate: string; // YYYY-MM-DD
  dueTime?: string; // HH:mm
  timeZone?: string; // IANA zone, such as Africa/Accra
  reminderOffsetMinutes?: number;
  priority: TaskPriority;
  done: boolean;
}

const standaloneCollection = (uid: string) =>
  collection(db!, "users", uid, "standalone_tasks");

export async function listStandaloneTasks(uid: string): Promise<StandaloneTask[]> {
  requireDb();
  const snapshot = await getDocs(standaloneCollection(uid));
  return snapshot.docs
    .map((entry) => ({
      ...(entry.data() as Omit<StandaloneTask, "id">),
      id: entry.id,
    }))
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) ||
        (a.dueTime ?? "").localeCompare(b.dueTime ?? ""),
    );
}

export async function createStandaloneTask(
  uid: string,
  input: Omit<StandaloneTask, "id" | "done">,
): Promise<string> {
  requireDb();
  const reference = await addDoc(standaloneCollection(uid), {
    ...input,
    done: false,
  });
  return reference.id;
}

export async function setStandaloneTaskDone(
  uid: string,
  taskId: string,
  done: boolean,
): Promise<void> {
  requireDb();
  await updateDoc(doc(db!, "users", uid, "standalone_tasks", taskId), { done });
}

export async function deleteStandaloneTask(
  uid: string,
  taskId: string,
): Promise<void> {
  requireDb();
  await deleteDoc(doc(db!, "users", uid, "standalone_tasks", taskId));
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export async function listSchedule(
  eventId: string,
): Promise<ScheduleEntry[]> {
  requireDb();
  const snapshot = await getDocs(scheduleCollection(eventId));
  return snapshot.docs
    .map((entry) => ({
      ...(entry.data() as Omit<ScheduleEntry, "id">),
      id: entry.id,
    }))
    .sort((a, b) =>
      (a.date + a.startAt).localeCompare(b.date + b.startAt),
    );
}

export async function createScheduleEntry(
  eventId: string,
  input: Omit<ScheduleEntry, "id" | "eventId">,
): Promise<string> {
  requireDb();
  const reference = await addDoc(scheduleCollection(eventId), input);
  return reference.id;
}

export async function updateScheduleEntry(
  eventId: string,
  entryId: string,
  input: Omit<ScheduleEntry, "id" | "eventId">,
): Promise<void> {
  requireDb();
  await updateDoc(doc(db!, "events", eventId, "schedule", entryId), input);
}
