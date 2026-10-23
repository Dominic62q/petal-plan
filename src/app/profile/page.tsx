"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Bell, BellOff, CircleAlert, LoaderCircle, LogOut, Pencil, Send, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-provider";
import { BrandLogo } from "@/components/brand-logo";
import { Stagger, StaggerItem, springs } from "@/components/motion-primitives";
import { GroupHeading, ScreenShell } from "@/components/page-header";
import { RequireAuth } from "@/components/require-auth";
import {
  disablePushNotifications,
  enablePushNotifications,
  pushSubscriptionCount,
  sendTestPushNotification,
} from "@/lib/push-notifications";
import { cn } from "@/lib/utils";

function NameForm({ initial, onSave, onDone }: { initial: string; onSave: (name: string) => Promise<void>; onDone: () => void }) {
  const [name, setName] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setProblem("");
    try {
      await onSave(name);
      onDone();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "Could not save your name. Try again.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="display-name">Your name</Label>
        <Input
          id="display-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          autoComplete="name"
          autoFocus
          className="h-12 text-base"
        />
      </div>
      {problem ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          {problem}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Save name
        </Button>
      </DialogFooter>
    </form>
  );
}

function ProfileContent() {
  const { user, signOut, updateDisplayName } = useAuth();
  const [nameOpen, setNameOpen] = useState(false);
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const [pushCount, setPushCount] = useState<number | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const [pushError, setPushError] = useState("");

  useEffect(() => {
    if (!user?.uid) return;
    void pushSubscriptionCount(user.uid)
      .then(setPushCount)
      .catch(() => setPushCount(0));
  }, [user?.uid]);

  const enableNotifications = async () => {
    if (!user?.uid) return;
    setPushBusy(true);
    setPushError("");
    setPushMessage("");
    try {
      const result = await enablePushNotifications(user.uid);
      if (result === "unsupported") {
        setPushError("This browser cannot receive push notifications.");
      } else if (result === "denied") {
        setPushError("Notification permission was not granted. Enable it in your browser or device settings.");
      } else {
        setPushCount(await pushSubscriptionCount(user.uid));
        setPushMessage("Notifications are enabled on this device.");
      }
    } catch (error) {
      setPushError(error instanceof Error ? error.message : "Could not enable notifications.");
    } finally {
      setPushBusy(false);
    }
  };

  const disableNotifications = async () => {
    if (!user?.uid) return;
    setPushBusy(true);
    setPushError("");
    setPushMessage("");
    try {
      await disablePushNotifications(user.uid);
      setPushCount(await pushSubscriptionCount(user.uid));
      setPushMessage("Notifications are disabled on this device.");
    } catch (error) {
      setPushError(error instanceof Error ? error.message : "Could not disable notifications.");
    } finally {
      setPushBusy(false);
    }
  };

  const testNotifications = async () => {
    setPushBusy(true);
    setPushError("");
    setPushMessage("");
    try {
      const delivered = await sendTestPushNotification();
      setPushMessage(delivered > 0 ? "Test notification sent." : "No active device subscriptions were found.");
    } catch (error) {
      setPushError(error instanceof Error ? error.message : "Could not send a test notification.");
    } finally {
      setPushBusy(false);
    }
  };
  const displayName = user?.displayName || "Planner";
  const initial = displayName.charAt(0).toUpperCase();
  const email = user?.email ?? "No email address";
  const memberSince = user?.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  const performSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  };

  const detailRows: Array<[string, string]> = [
    ["Sign-in method", "Email & password"],
    ["Email", email],
    ["Member since", memberSince],
  ];

  return (
    <ScreenShell
      title="Account"
      canvas={
        <div className="flex items-center gap-4">
          <motion.span
            initial={{ scale: 0.5, opacity: 0, rotate: -12 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={springs.pop}
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white font-heading text-4xl font-bold text-primary shadow-float"
          >
            {initial}
          </motion.span>
          <div className="min-w-0">
            <h2 className="truncate font-heading text-2xl font-bold tracking-tight">{displayName}</h2>
            <p className="truncate text-base font-bold text-white/85">{email}</p>
          </div>
        </div>
      }
    >
      <Stagger className="space-y-6" gap={0.07}>
        <StaggerItem>
          <section aria-labelledby="notifications-heading">
            <GroupHeading>
              <span id="notifications-heading">Notifications</span>
            </GroupHeading>
            <div className="rounded-3xl bg-secondary/60 p-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors",
                    pushCount ? "bg-brand text-primary-foreground" : "bg-card text-muted-foreground",
                  )}
                >
                  {pushCount ? <Bell className="h-6 w-6" aria-hidden /> : <BellOff className="h-6 w-6" aria-hidden />}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold">Push reminders</h3>
                  <p className="mt-0.5 text-sm leading-6 text-muted-foreground">
                    Get event and timed-task reminders even when Petal &amp; Plan is closed.
                  </p>
                  <p className="mt-2 text-sm font-semibold text-primary">
                    {pushCount === null
                      ? "Checking this device…"
                      : pushCount > 0
                        ? `On for ${pushCount} ${pushCount === 1 ? "device" : "devices"}`
                        : "Off on this device"}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {pushCount ? (
                  <>
                    <Button variant="outline" disabled={pushBusy} onClick={() => void testNotifications()} className="h-11">
                      {pushBusy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                      Send test
                    </Button>
                    <Button variant="outline" disabled={pushBusy} onClick={() => void disableNotifications()} className="h-11">
                      Turn off here
                    </Button>
                  </>
                ) : (
                  <Button disabled={pushBusy} onClick={() => void enableNotifications()} className="h-11">
                    {pushBusy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Bell className="h-4 w-4" aria-hidden />}
                    Enable notifications
                  </Button>
                )}
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                On iPhone, install Petal &amp; Plan to the Home Screen before enabling notifications.
              </p>
              {pushMessage ? (
                <p role="status" className="mt-3 rounded-2xl bg-card px-4 py-2.5 text-sm font-semibold text-primary">
                  {pushMessage}
                </p>
              ) : null}
              {pushError ? (
                <p role="alert" className="mt-3 flex gap-2 rounded-2xl bg-destructive/10 px-4 py-2.5 text-sm font-bold text-destructive">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {pushError}
                </p>
              ) : null}
            </div>
          </section>
        </StaggerItem>

        <StaggerItem>
          <section aria-labelledby="account-details-heading">
            <GroupHeading>
              <span id="account-details-heading">Details</span>
            </GroupHeading>
            <dl className="divide-y divide-card overflow-hidden rounded-3xl bg-secondary/60">
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-sm font-bold text-muted-foreground">Name</dt>
                <dd className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 truncate text-sm font-semibold">{user?.displayName || "Not set"}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setNameOpen(true)}
                    aria-label="Edit your name"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                </dd>
              </div>
              {detailRows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 px-4 py-4">
                  <dt className="text-sm font-bold text-muted-foreground">{label}</dt>
                  <dd className="min-w-0 truncate text-sm font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </StaggerItem>

        <StaggerItem>
          <section aria-label="Account actions" className="space-y-4">
            <div className="flex items-center gap-3 px-1 text-sm text-muted-foreground">
              <ShieldCheck className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <p>Your data is tied to this signed-in account.</p>
            </div>

            <Button
              variant="outline"
              onClick={() => setConfirmOpen(true)}
              className="h-14 w-full border-destructive/30 text-base text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-5 w-5" aria-hidden />
              Sign out
            </Button>

            <p className="flex items-center justify-center gap-2 pt-2 text-xs font-semibold text-muted-foreground">
              <BrandLogo variant="mark" size="sm" decorative className="h-5 w-5" />
              Petal &amp; Plan
            </p>
          </section>
        </StaggerItem>
      </Stagger>

      <Dialog open={nameOpen} onOpenChange={setNameOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Your name</DialogTitle>
            <DialogDescription>Used for your greeting and by the assistant.</DialogDescription>
          </DialogHeader>
          <NameForm initial={user?.displayName ?? ""} onSave={updateDisplayName} onDone={() => setNameOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>You&apos;ll need to sign in again to see your events and tasks.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={signingOut} onClick={() => void performSignOut()}>
              {signingOut ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScreenShell>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}
