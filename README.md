# Petal & Plan

Event-planning PWA (Next.js + Firebase). See `FRONTEND_UI_PLAYBOOK.md` in
AssetTrackPro for the UI rules this project follows.

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind v4 + shadcn/ui primitives (Petals & Plan tokens in `src/app/globals.css`)
- TanStack Query for server state; Firebase Auth + Firestore backend
- PWA via Serwist (`src/app/sw.ts`, offline fallback `/~offline`)

## Develop

```bash
npm run dev        # http://localhost:3000 (Turbopack; service worker disabled in dev)
npm run build      # production build (webpack — required by the Serwist plugin)
npm start          # serve the production build
```

## Deploy the frontend to Vercel

The GitHub repository is ready to import into Vercel. Vercel hosts the Next.js
frontend; Firebase continues to host Authentication, Firestore, and the
deployed reminder Functions.

1. Import `https://github.com/Dominic62q/petal-plan` into Vercel.
2. Keep the project root at the repository root and use the Next.js framework preset.
3. Keep the committed `vercel.json`. It forces Vercel to run `npm run build`,
   which uses `next build --webpack` for the Serwist service-worker build.
4. Add all variables from `.env.example` to the **Preview** and **Production**
   environments in Vercel.
5. Deploy the project, then add the generated Vercel domain (and any custom
   domain) to Firebase Authentication → Settings → Authorized domains.

Do not add Firebase Functions secrets or `VAPID_PRIVATE_KEY` to Vercel. The
frontend only needs the public Firebase web configuration and
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

## Firebase setup

1. Create a project at <https://console.firebase.google.com>.
2. Add a **Web app**, copy its config.
3. Fill `.env.local` (see `.env.example`).
4. Enable **Authentication → Email/password** (and Phone if desired).
5. Create a **Cloud Firestore named database** with the ID `petal-db` in production mode.
6. Deploy the rules and indexes:

   ```bash
   firebase deploy --only firestore
   ```

## Environment variables

All client-side (`NEXT_PUBLIC_`) — Firebase web keys are public by design;
security comes from Firestore rules.

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
```

## Data model (Firestore)

```
users/{uid}                          — profile: displayName, createdAt
events/{eventId}                     — ownerUid, title, date, time, status
events/{eventId}/tasks/{taskId}      — title, group, priority, dueDate, done
users/{uid}/standalone_tasks/{id}    — title, priority, dueDate, done
```

## Notes

- The final Petal & Plan brand mark is used throughout the app, favicon, PWA
  icons, Apple touch icon, and push notifications.
- iOS install: Safari → Share → *Add to Home Screen* (no programmatic prompt).
