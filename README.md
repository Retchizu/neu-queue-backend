# NEU Queue Backend

Backend for the NEU Queue system, implemented as Firebase Cloud Functions (Node.js/TypeScript).

## Firebase and service account setup

- **Firebase project**: This repo is configured for Firebase project **`retchizu-94b36`** (see `.firebaserc`).
- **Realtime Database URL**: Create `functions/.env` and set `DATABASE_URL` to your project’s Realtime Database URL.
- **Service account key**:
  - In Firebase Console, open the project → Project settings (gear) → **Service accounts**.
  - Click **Generate new private key** and download the JSON.
  - Save it as **`functions/serviceAccountKey.json`** (gitignored; do **not** commit it).

For full local setup (Redis, other env vars, emulator commands), see `documentation/setup-and-running.md`.