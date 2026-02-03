# Setting Up Environments and Running on Localhost

This guide covers environment variables, local setup, and running the NEU Queue backend (Cloud Functions) on your machine using the Firebase emulator.

## Prerequisites

- **Node.js** — Version **22** (see `functions/package.json` `engines.node`). Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) if you need to switch versions.
- **Firebase CLI** — Install: `npm install -g firebase-tools`. Log in: `firebase login`.
- **Redis** — The app connects to Redis (e.g. [Redis Cloud](https://redis.com/try-free/) or a local Redis). For local dev you can use the same Redis host as production and set `REDIS_PASSWORD` in `.env`, or run Redis locally and adjust the config if needed.
- **Firebase project** — The repo is wired to project **retchizu-94b36** (see `.firebaserc`). You need access to this project for `serviceAccountKey.json` and (optionally) live Firestore/Auth when using the emulator.

---

## 1. Clone and install

```bash
cd /path/to/neu-queue-backend
cd functions
npm install
```

---

## 2. Environment variables

Create a **`.env`** file inside the **`functions`** folder. It is gitignored; do not commit it.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Firebase Realtime Database URL (e.g. `https://retchizu-94b36-default-rtdb.asia-southeast1.firebasedatabase.app`). From Firebase Console → Project Settings → Your apps. |
| `REDIS_PASSWORD` | Yes | Password for the Redis instance used in `functions/src/config/redisClient.ts`. |
| `JWT_SECRET` | Yes | Secret used for JWT/session (e.g. queue QR flow). Used in `queueControllers.ts`. |
| `EMAIL` | Optional | Gmail address for Nodemailer (e.g. “NEUQueue System”). Required if you use send-email features. |
| `PASSWORD` | Optional | Gmail app password (not your normal password). Required if you use send-email features. |

**Example `.env` (copy and fill in real values):**

```env
DATABASE_URL=https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app
REDIS_PASSWORD=your_redis_password
JWT_SECRET=your_jwt_secret
EMAIL=your-app@gmail.com
PASSWORD=your-gmail-app-password
```

---

## 3. Firebase service account (local auth to Firebase)

The code uses **`serviceAccountKey.json`** in the **`functions`** folder (see `functions/src/config/firebaseConfig.ts`). It is gitignored.

1. Firebase Console → Project **retchizu-94b36** → Project settings (gear) → **Service accounts**.
2. Click **Generate new private key** and download the JSON.
3. Save it as **`functions/serviceAccountKey.json`**.

Do not commit this file.

---

## 4. Running on localhost

All commands below are run from the **`functions`** directory.

### Build

```bash
npm run build
```

### Start the Functions emulator (recommended for dev)

```bash
npm run dev
```

This runs:

1. `npm run build`
2. `firebase emulators:start --inspect-functions --only functions`

You can attach a Node debugger (e.g. from VS Code) when using `dev`.

**Alternative (no debugger):**

```bash
npm run serve
```

This uses `--only functions,pubsub` (adds Pub/Sub emulator if you use it later).

### Local API base URL

The HTTP function is exported as **`neu`** (v2 HTTPS onRequest). When the emulator is running, the base URL is:

```text
http://localhost:5001/retchizu-94b36/us-central1/neu
```

Examples:

- Health/root: `GET http://localhost:5001/retchizu-94b36/us-central1/neu`
- A route under the app: `GET http://localhost:5001/retchizu-94b36/us-central1/neu/api/...`

The emulator UI usually runs at **http://localhost:4000** (or the port printed in the terminal). From there you can confirm the function name and region if they change.

**Note:** Firestore and Auth are **not** emulated by default. With the current setup, the function still talks to the **live** Firebase project (Firestore, Auth) for data and users. Only the function code runs locally. To emulate Firestore/Auth as well, you’d add an `emulators` block in `firebase.json` and (if needed) connect the Admin SDK to the emulators in code.

---

## 5. CORS and local frontend

`functions/src/index.ts` allows specific `allowedOrigins`. For a frontend on **localhost**, add your dev origin, for example:

```ts
const allowedOrigins = [
  "https://en-queue-customer.vercel.app",
  "https://en-queue-information.vercel.app",
  "https://enqueue-alpha.vercel.app",
  "https://en-queue-cashier.vercel.app",
  "http://localhost:3000",   // add your local frontend URL
];
```

Restart the emulator after changing code.

---

## 6. Quick reference

| Task | Command (from `functions/`) |
|------|-----------------------------|
| Install deps | `npm install` |
| Lint | `npm run lint` |
| Build | `npm run build` |
| Run locally (with debug) | `npm run dev` |
| Run locally (no debug) | `npm run serve` |
| Deploy functions | `npm run deploy` |
| View logs | `npm run logs` |

**Local base URL:** `http://localhost:5001/retchizu-94b36/us-central1/neu`

---

## 7. Troubleshooting

- **“Cannot find module '../serviceAccountKey.json'”** — Ensure `serviceAccountKey.json` is in `functions/` and not gitignored in a way that removes it from your local copy.
- **Redis connection errors** — Check `REDIS_PASSWORD` and that the Redis host in `redisClient.ts` is reachable (e.g. allow your IP in Redis Cloud).
- **CORS errors from browser** — Add your frontend origin (e.g. `http://localhost:3000`) to `allowedOrigins` in `functions/src/index.ts`.
- **Firestore/Auth permission or “project not found”** — Confirm `serviceAccountKey.json` is for project **retchizu-94b36** and that `DATABASE_URL` matches the same project.
