"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellOff, ChevronLeft, CircleAlert, LoaderCircle, LogOut, Send, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth-provider";
import { BrandLogo } from "@/components/brand-logo";
import { RequireAuth } from "@/components/require-auth";
import {
  disablePushNotifications,
  enablePushNotifications,
  pushSubscriptionCount,
  sendTestPushNotification,
} from "@/lib/push-notifications";

function ProfileContent() {
  const { user, signOut } = useAuth();
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

  return (
    <div className="min-h-full bg-background">
      <div
        className="mx-auto max-w-4xl px-4 pb-12 sm:px-6 lg:px-10"
        style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-5 inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring lg:hidden"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Back
        </button>

        <header className="border-b border-border pb-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Workspace settings</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="font-heading text-4xl font-extrabold tracking-[-0.06em] sm:text-5xl">Account</h1>
            <p className="text-sm text-muted-foreground">Your identity and access</p>
          </div>
        </header>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-14">
          <main>
            <section aria-labelledby="identity-heading">
              <p id="identity-heading" className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Identity</p>
              <div className="mt-4 flex items-center gap-4 border-b border-border pb-6">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-foreground font-heading text-xl font-extrabold text-background">
                  {initial}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-heading text-xl font-extrabold tracking-[-0.035em]">{displayName}</h2>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{email}</p>
                </div>
              </div>
            </section>

            <section className="mt-8" aria-labelledby="account-details-heading">
              <p id="account-details-heading" className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Account details</p>
              <dl className="mt-3 divide-y divide-border border-y border-border">
                <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-4 py-4 text-sm">
                  <dt className="text-muted-foreground">Sign-in method</dt>
                  <dd className="font-semibold">Email &amp; password</dd>
                </div>
                <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-4 py-4 text-sm">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="truncate font-semibold">{email}</dd>
                </div>
                <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-4 py-4 text-sm">
                  <dt className="text-muted-foreground">Member since</dt>
                  <dd className="font-semibold">{memberSince}</dd>
                </div>
              </dl>
            </section>

            <section className="mt-8" aria-labelledby="notifications-heading">
              <p id="notifications-heading" className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Notifications</p>
              <div className="mt-3 border-y border-border py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold">Push reminders</h2>
                    <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">
                      Receive event and timed-task reminders even when Petal &amp; Plan is closed.
                    </p>
                  </div>
                  {pushCount ? <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden /> : <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                </div>
                <p className="mt-4 text-xs font-semibold text-muted-foreground">
                  {pushCount === null ? "Checking this device…" : pushCount > 0 ? `Enabled on ${pushCount} ${pushCount === 1 ? "device" : "devices"}` : "Not enabled on this device"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {pushCount ? (
                    <>
                      <Button variant="outline" disabled={pushBusy} onClick={() => void testNotifications()} className="min-h-10 rounded-md">
                        {pushBusy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                        Send test
                      </Button>
                      <Button variant="outline" disabled={pushBusy} onClick={() => void disableNotifications()} className="min-h-10 rounded-md">
                        Disable on this device
                      </Button>
                    </>
                  ) : (
                    <Button disabled={pushBusy} onClick={() => void enableNotifications()} className="min-h-10 rounded-md">
                      {pushBusy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Bell className="h-4 w-4" aria-hidden />}
                      Enable notifications
                    </Button>
                  )}
                </div>
                <p className="mt-4 text-xs leading-5 text-muted-foreground">On iPhone, install Petal &amp; Plan to the Home Screen before enabling notifications.</p>
                {pushMessage ? <p role="status" className="mt-4 text-sm text-primary">{pushMessage}</p> : null}
                {pushError ? <p role="alert" className="mt-4 flex gap-2 text-sm text-destructive"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{pushError}</p> : null}
              </div>
            </section>
          </main>

          <aside className="border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0" aria-label="Account actions">
            <div className="border-b border-border pb-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">About Petal &amp; Plan</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                A focused place for your events, event tasks, and personal tasks—without inventing work for you.
              </p>
            </div>

            <div className="flex items-start gap-3 border-b border-border py-5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-semibold">Account access</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Your data is tied to this signed-in account.</p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setConfirmOpen(true)}
              className="mt-5 min-h-10 w-full rounded-md border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </Button>

            <p className="mt-8 flex items-center gap-1.5 text-xs text-muted-foreground">
              <BrandLogo variant="mark" size="sm" decorative className="h-4 w-4" />
              Petal &amp; Plan
            </p>
          </aside>
        </div>

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
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileContent />
    </RequireAuth>
  );
}
