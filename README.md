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
```

## Data model (Firestore)

```
users/{uid}                          — profile: displayName, createdAt
events/{eventId}                     — ownerUid, title, date, time, status
events/{eventId}/tasks/{taskId}      — title, group, priority, dueDate, done
users/{uid}/standalone_tasks/{id}    — title, priority, dueDate, done
```

## Notes

- Icons in `public/icons/` are generated placeholders — replace with final
  brand art before release (keep the same filenames/sizes).
- iOS install: Safari → Share → *Add to Home Screen* (no programmatic prompt).
