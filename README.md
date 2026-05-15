# Aaradhna Ice Dish & Gola

Live token, billing, kitchen, prep, owner-report, and customer self-order system for MacBook, phone, tablet, and TV.

## Stack

- Frontend: static HTML, CSS, JS
- Live hosting: Vercel
- Backend API: Vercel Serverless Function
- Database: Firebase Firestore

## Pages

- `/` billing counter
- `/customer.html` self-order
- `/display.html` customer-facing second screen
- `/prep.html` preparation screen
- `/kitchen.html` kitchen display
- `/owner.html` owner report
- `/menu.html` menu and flavour editor

## Local Mac version

The current local server still works:

```bash
npm run serve:local
```

## Vercel + Firebase setup

### 1. Create Firebase project

1. Open Firebase Console
2. Create project
3. Enable Firestore Database
4. Create a service account from:
   `Project Settings -> Service Accounts -> Generate New Private Key`

### 2. Add Vercel environment variables

Add these in Vercel project settings:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

For the private key, keep the full key including:

```text
-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----
```

### 3. Deploy

```bash
npm install
npm i -g vercel
vercel
```

For local Vercel testing:

```bash
vercel dev
```

## API

The frontend keeps the same routes:

- `GET/PUT /api/menu`
- `GET/PUT /api/flavours`
- `GET/PUT /api/data`
- `GET/PUT /api/display`
- `POST /api/bills`
- `POST /api/self-orders`
- `PATCH /api/self-orders/:id`
- `POST /api/self-orders/:id/accept-payment`
- `PATCH /api/bills/:id`
- `POST /api/close-day`

## Notes

- The Vercel/Firebase version is designed to preserve the current frontend behavior.
- Firestore currently stores live operational data in one main document for simplicity.
- If your daily volume grows a lot, the next upgrade should split bills and self-orders into separate collections.
