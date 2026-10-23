"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  type User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";

type AuthStatus = "loading" | "signed-in" | "signed-out" | "unconfigured";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    name: string,
    email: string,
    password: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  /** Saves a new display name to the sign-in account and to the profile document. */
  updateDisplayName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
async function ensureUserProfile(user: User, displayName?: string): Promise<void> {
  if (!db) return;
  const profileReference = doc(db, "users", user.uid);
  const snapshot = await getDoc(profileReference);
  const existing = snapshot.data() as { displayName?: string; createdAt?: string } | undefined;
  const profile: Record<string, string> = {};
  const resolvedName = displayName?.trim() || user.displayName?.trim();
  if (!existing?.displayName && resolvedName) profile.displayName = resolvedName;
  if (!existing?.createdAt && user.metadata.creationTime) {
    profile.createdAt = new Date(user.metadata.creationTime).toISOString();
  }
  if (Object.keys(profile).length > 0) {
    await setDoc(profileReference, profile, { merge: true });
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  // Firebase changes the name on the same User object, so React would not
  // notice; bumping this makes everything that reads user.displayName re-render.
  const [nameVersion, setNameVersion] = useState(0);
  const [status, setStatus] = useState<AuthStatus>(
    isFirebaseConfigured() ? "loading" : "unconfigured",
  );

  useEffect(() => {
    if (!auth) return;
    // The listener always wins when it resolves — however long it takes.
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setAuthResolved(true);
      setUser(nextUser);
      setStatus(nextUser ? "signed-in" : "signed-out");
      if (nextUser) void ensureUserProfile(nextUser).catch(() => undefined);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (authResolved || !isFirebaseConfigured()) return;
    // UI-only safety net: never spin past 6s. If the SDK is still restoring,
    // we show signed-out; the real listener updates later if it lands.
    const fallback = window.setTimeout(() => {
      setStatus((current) => (current === "loading" ? "signed-out" : current));
    }, 6000);
    return () => window.clearTimeout(fallback);
  }, [authResolved]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      async signIn(email, password) {
        if (!auth) throw new Error("Firebase is not configured");
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signUp(name, email, password) {
        if (!auth || !db) throw new Error("Firebase is not configured");
        const credential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        await updateProfile(credential.user, { displayName: name });
        // Auth succeeds independently; the auth listener retries profile repair
        // if this first write is interrupted.
        await ensureUserProfile(credential.user, name).catch(() => undefined);
      },
      async signOut() {
        if (!auth) throw new Error("Firebase is not configured");
        await firebaseSignOut(auth);
      },
      async updateDisplayName(name) {
        const current = auth?.currentUser;
        if (!current || !db) throw new Error("You need to be signed in.");
        const displayName = name.trim().replace(/\s+/g, " ");
        if (!displayName) throw new Error("Enter a name.");
        if (displayName.length > 40) throw new Error("Keep the name to 40 characters or fewer.");
        await updateProfile(current, { displayName });
        await setDoc(doc(db, "users", current.uid), { displayName }, { merge: true });
        setNameVersion((version) => version + 1);
      },
    }),
    // nameVersion is not read inside; it re-publishes the context after a rename.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, user, nameVersion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
