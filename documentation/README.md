# NEU Queue Backend — Documentation

## Firebase and service account setup

The backend is deployed as Firebase Cloud Functions and talks to Firebase Realtime Database, Firestore, and Auth using a service account.

- **Firebase project**: The codebase is wired to project **`retchizu-94b36`** (see `.firebaserc`).
- **Database URL**: Add your Realtime Database URL as `DATABASE_URL` in `functions/.env` (see `setup-and-running.md` for the full table).
- **Service account key file**:
  - Go to Firebase Console → Project **retchizu-94b36** → Project settings (gear) → **Service accounts**.
  - Click **Generate new private key** and download the JSON.
  - Save it as **`functions/serviceAccountKey.json`** (this file is gitignored and must **never** be committed).

For more detail (including other environment variables and emulator commands), see **[Setup and running on localhost](./setup-and-running.md)**.

## Contents

- **[Setup and running on localhost](./setup-and-running.md)** — Environment variables, Firebase setup, and running the backend locally with the emulator.
- **[Data model](./data-model/README.md)** — Firestore collections and entity docs (Stations, Counters, Queue, Blacklist, Cashiers, Customer Session, Activity Log, queue-number-counters).
- **[API Endpoints](./api-endpoints/README.md)** — REST API documentation for all routes (Admin, Analytics, Counters, Queues, Stations, Auth).
