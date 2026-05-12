# Big Basket Shop

A complete web application for managing shop invoices.  
Built with **React + Vite** (frontend) and **Firebase** (backend, database, hosting).

**No credit card needed. No paid plan. Works 100% on Firebase's free Spark plan.**

---

## What This App Does

| Role | What they can do |
|------|-----------------|
| **Admin** | Manage users, view all invoices, see audit logs |
| **User** | Upload invoices (PDF/image/manual entry), view their own invoices |

> **About file uploads:** When a user uploads a PDF or image, the app reads it locally in the browser to extract invoice data (using OCR). The file itself is **not uploaded or stored online** — only the invoice details (number, vendor, amounts, etc.) are saved to the database. This is what keeps the app free.

---

## Before You Start — What Is Firebase?

Firebase is a free service by Google. This app uses three parts of it:

| Firebase service | What it does in this app |
|---|---|
| **Authentication** | Handles admin and user login securely |
| **Firestore** | Cloud database — stores users, invoices, audit logs |
| **Hosting** | Publishes your website to the internet for free |

That's it. No Functions, no Storage — all three services above are free forever.

---

## How Login Works

| Role | How they log in |
|------|----------------|
| **Admin** | Fixed username (`bb_admin`) + 4-digit PIN. Created once using a setup script. |
| **User** | Username + 4-digit PIN. Created by the admin inside the app. |

No email addresses are ever entered by users. There is no "Forgot password" link — the admin PIN can be reset by re-running the setup script.

---

## Step-by-Step Setup Guide

### Step 1 — Create a Google Account
If you already have a Gmail account, skip this step.  
Otherwise, go to [accounts.google.com](https://accounts.google.com) and create one.

---

### Step 2 — Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. Enter a project name, e.g. `bigbasket-shop`
4. Click **Continue** (you can disable Google Analytics if you want)
5. Click **Create project**
6. Wait for it to finish, then click **Continue**

---

### Step 3 — Enable Firestore Database

1. In the Firebase console, click **"Firestore Database"** in the left menu
2. Click **"Create database"**
3. Choose **"Start in production mode"** (security rules are already written for you)
4. Choose a location closest to you (e.g. `asia-south1` for India, `europe-west1` for Europe)
5. Click **Enable**

---

### Step 4 — Enable Authentication

1. In the Firebase console, click **"Authentication"** in the left menu
2. Click **"Get started"**
3. Click on **"Email/Password"**
4. Enable the top toggle (**"Email/Password"**) → click **Save**

> Even though neither admin nor users type an email address, Firebase Authentication uses email/password internally. The app handles this automatically — users only ever see a username and PIN.

---

### Step 5 — Register Your Web App and Get Config

1. On the Firebase console home page, click the **`</>`** (web) icon
2. Give your app a nickname, e.g. `bigbasket-web`
3. Check **"Also set up Firebase Hosting"** ← important
4. Click **"Register app"**
5. You will see a block of code — copy the values from it:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "my-project.firebaseapp.com",
  projectId:         "my-project",
  storageBucket:     "my-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123",
};
```

6. Copy `frontend/.env.example` to `frontend/.env`:
   ```bash
   cp frontend/.env.example frontend/.env
   ```
7. Open `frontend/.env` and fill in your values:
   ```
   VITE_FIREBASE_API_KEY=AIzaSy...
   VITE_FIREBASE_AUTH_DOMAIN=my-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=my-project
   VITE_FIREBASE_STORAGE_BUCKET=my-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abc123
   ```
8. Click **"Next"** and **"Continue to console"** in Firebase

---

### Step 6 — Link This Project to Your Firebase Project

Open `.firebaserc` in this project folder and replace the project ID with your actual one:

```json
{
  "projects": {
    "default": "your-project-id"
  }
}
```

Your project ID is shown in Firebase Console → gear icon ⚙️ → **"Project settings"** → listed under **"Project ID"** (e.g. `bigbasket-d55a2`).

---

### Step 7 — Install Node.js

Node.js is needed to build the app and run the setup scripts.

1. Go to [nodejs.org](https://nodejs.org)
2. Download the **LTS** version and install it
3. To verify: open a terminal and type `node --version` — you should see `v18.x.x` or higher

---

### Step 8 — Install Firebase CLI

```bash
npm install -g firebase-tools
```

Then log in:
```bash
firebase login
```

A browser window will open — sign in with the same Google account you used for the Firebase project.

---

### Step 9 — Deploy the App

From the project root folder, run:

```bash
bash deploy.sh
```

This will:
1. Install frontend dependencies
2. Build the React app
3. Deploy the website and Firestore security rules to Firebase

After it finishes, you will see a **Hosting URL** like:
```
https://your-project-id.web.app
```

---

### Step 11 — Create the Admin Account

Run the one-time setup script to create the `bb_admin` account:

```bash
node scripts/create-admin.mjs
```

It will prompt you for a 4-digit PIN. This PIN is what you use to log into the app as admin.

```
🔧  Big Basket Shop — Admin Account Setup
   Username : bb_admin
   Auth email (internal): bb_admin@shopapp.internal

Enter a 4-digit PIN for bb_admin: ****
✅  Firebase Auth user created.
✅  Firestore admins/{uid} document created/updated.
✅  Done! Sign in at the app with username "bb_admin" and your PIN.
```

**To change the admin PIN later:** simply re-run the same script and enter a new PIN. It will update the existing account.

---

### Step 12 — Open the App

Go to your Hosting URL (e.g. `https://your-project-id.web.app`):

- Click **"Admin"** → enter username `bb_admin` and your PIN
- You are now on the Admin Dashboard

---

## How to Use the App

### Admin Login
1. Go to your app URL → click **"Admin"**
2. Enter username `bb_admin` and your 4-digit PIN
3. Click **"Sign In"**

### Creating a Shop User (as Admin)
1. Log in as Admin → click **"Users"** in the sidebar
2. Click **"+ New User"**
3. Fill in: Full Name, Username, Shop Name, Phone Number, PIN (4 digits)
4. Click **"Create User"**
5. Share the username and PIN with that person

### User Login
1. Go to your app URL → click **"Shop User"**
2. Enter the username and PIN the admin created
3. Click **"Sign In"**

### Uploading an Invoice
1. Log in as a User — you are already on the Upload page
2. Drag and drop a PDF or image, or click **"Manual Entry"**
3. If you upload a file: the app reads it locally and tries to fill in the fields automatically
4. Review and correct any fields, then click **"Save Invoice"**

---

## Project Structure

```
bigbasket/
├── README.md                          ← This file
├── package.json                       ← All dependencies + npm scripts (dev, build)
├── vite.config.js                     ← Vite build config (root set to frontend/)
├── firebase.json                      ← Firebase project configuration
├── .firebaserc                        ← ⚠️  Put your Firebase project ID here
├── firestore.rules                    ← Database security rules (already written)
├── firestore.indexes.json             ← Firestore index definitions
├── deploy.sh                          ← One-command deploy script
├── scripts/
│   └── create-admin.mjs               ← One-time admin account setup
└── frontend/                          ← React source code
    ├── index.html
    ├── .env.example                   ← Template — copy to .env and fill in values
    ├── .env                           ← ⚠️  Your Firebase config (gitignored)
    └── src/
        ├── main.jsx                   ← Entry point
        ├── App.jsx                    ← Routes
        ├── firebase/
        │   └── config.js             ← Reads config from .env
        ├── contexts/
        │   └── AuthContext.jsx        ← Manages who is logged in and their role
        ├── components/
        │   ├── LoadingSpinner.jsx
        │   ├── Toast.jsx              ← Success/error messages
        │   └── ProtectedRoute.jsx     ← Blocks pages if not logged in
        ├── pages/
        │   ├── RoleSelection.jsx      ← Home page (Admin or User?)
        │   ├── AdminLogin.jsx         ← Username + PIN login for admin
        │   ├── UserLogin.jsx          ← Username + PIN login for shop users
        │   ├── AdminDashboard.jsx     ← Admin home with stats
        │   ├── UserManagement.jsx     ← Create/edit/disable users
        │   ├── InvoiceUpload.jsx      ← Upload or manually enter invoice
        │   ├── InvoiceList.jsx        ← View invoices (with receipt thumbnails)
        │   └── AuditLogs.jsx          ← View action history
        ├── utils/
        │   ├── hashPin.js             ← SHA-256 PIN hashing (browser built-in)
        │   ├── ocrProcessor.js        ← Extract text from PDFs/images locally
        │   └── auditLogger.js         ← Writes audit events to Firestore
        └── styles/
            └── main.css               ← All styles, plain CSS
```

---

## Firestore Data Structure

```
admins/                     ← Who can log in as admin
  {firebase-auth-uid}/      ← Document ID is the Firebase Auth UID (set by the script)
    username: string         ← e.g. "bb_admin"
    name: string             ← e.g. "Admin"
    createdAt: timestamp

users/                      ← Shop users created by admin
  {firebase-auth-uid}/      ← Document ID is the Firebase Auth UID
    fullName: string
    username: string         ← Unique, lowercase
    shopName: string
    phone: string
    status: "active" | "inactive" | "deleted"
    createdBy: string        ← Admin's Firebase Auth UID
    createdAt: timestamp

invoices/                   ← Invoice records
  {auto-id}/
    invoiceNumber: string
    vendorName: string
    invoiceDate: string
    taxId: string
    amount: number
    tax: number
    total: number
    currency: string
    createdBy: string        ← Firebase Auth UID of the user who saved it
    shopName: string
    thumbnailBase64: string  ← Small preview image (shown in table)
    previewBase64: string    ← Full-size preview (shown in lightbox)
    createdAt: timestamp

auditLogs/                  ← Record of all important actions
  {auto-id}/
    action: string           ← e.g. "USER_CREATED", "INVOICE_UPLOADED", "ADMIN_LOGIN"
    performedBy: string      ← Firebase Auth UID
    performedByName: string  ← Display name for the audit log view
    targetId: string         ← ID of the affected document (if any)
    details: object          ← Extra context (username, invoice number, etc.)
    timestamp: timestamp
```

---

## Troubleshooting

**Admin can't log in — "Invalid username or PIN"**
- Make sure you have run `node scripts/create-admin.mjs` successfully
- The username must be exactly `bb_admin` (lowercase)
- Re-run the script to set a new PIN if you forgot it

**Admin logs in but is immediately redirected back to home**
- The Firebase Auth account exists but the `admins/{uid}` Firestore document is missing
- Re-run `node scripts/create-admin.mjs` — it is safe to run multiple times

**User can't log in — "Invalid username or PIN"**
- Double-check the username (lowercase, no spaces)
- The PIN must match exactly what the admin set
- If the account is disabled, the admin must re-enable it in the Users page

**OCR doesn't extract invoice data correctly**
- OCR works best on clear, high-resolution images with good contrast
- All extracted fields are editable — correct anything wrong before saving

**Deployment fails**
- Make sure you ran `firebase login` and are signed in to the correct Google account
- Make sure the project ID in `.firebaserc` matches Firebase Console → Project Settings
- Make sure `frontend/.env` exists and has all six `VITE_FIREBASE_*` values filled in
- Make sure Node.js 18 or newer is installed (`node --version`)

**"permission-denied" error when using the app**
- Make sure Firestore rules were deployed — run `bash deploy.sh` again
- Try signing out and signing back in

**Script fails with "Cannot find module" or similar**
- Make sure you ran `bash deploy.sh` or `npm install` from the project root folder first

---

## Costs

**Monthly cost: $0.00 — no credit card ever required.**

This app uses only:
- Firebase **Authentication** — free (up to 10,000 users/month)
- Firebase **Firestore** — free (up to 1 GB storage, 50,000 reads/day)
- Firebase **Hosting** — free (up to 10 GB/month bandwidth)

For a typical small shop with a handful of users and dozens of invoices per month, you will use a tiny fraction of these limits.

---

## Security Notes

- **Admin PIN:** Hashed with SHA-256 + a per-user salt in the browser before being sent to Firebase. The plain PIN is never stored or transmitted.
- **User PINs:** Same SHA-256 hashing approach as admin.
- **Role separation:** Both admin and shop users use Firebase Email/Password auth with an internal synthetic domain (`@shopapp.internal`). Role is determined by whether a matching document exists in the `admins` Firestore collection — not by the email address alone.
- **Data access:** Firestore security rules ensure users can only read and write their own invoices.
- **File processing:** Invoice files (PDF/images) are processed entirely in the browser — they are never uploaded to any server.

---

## Upgrading Later (Optional)

If you ever need features that require a server (sending emails, storing uploaded files online), you can upgrade to the Firebase **Blaze plan** at any time. It is pay-as-you-go with the same free limits — you only pay if you go beyond them.


---

## What This App Does

| Role | What they can do |
|------|-----------------|
| **Admin** | Manage users, view all invoices, see audit logs |
| **User** | Upload invoices (PDF/image/manual entry), view their own invoices |

> **About file uploads:** When a user uploads a PDF or image, the app reads it locally in the browser to extract invoice data (using OCR). The file itself is **not uploaded or stored online** — only the invoice details (number, vendor, amounts, etc.) are saved to the database. This is what keeps the app free.

---

## Before You Start — What Is Firebase?

Firebase is a free service by Google. This app uses three parts of it:

| Firebase service | What it does in this app |
|---|---|
| **Authentication** | Handles admin magic-link login and user PIN login securely |
| **Firestore** | Cloud database — stores users, invoices, audit logs |
| **Hosting** | Publishes your website to the internet for free |

That's it. No Functions, no Storage — all three services above are free forever.

---

## Step-by-Step Setup Guide

### Step 1 — Create a Google Account
If you already have a Gmail account, skip this step.  
Otherwise, go to [accounts.google.com](https://accounts.google.com) and create one.

---

### Step 2 — Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **"Add project"**
3. Enter a project name, e.g. `shop-invoice-app`
4. Click **Continue** (you can disable Google Analytics if you want)
5. Click **Create project**
6. Wait for it to finish, then click **Continue**

---

### Step 3 — Enable Firestore Database

1. In the Firebase console, click **"Firestore Database"** in the left menu
2. Click **"Create database"**
3. Choose **"Start in production mode"** (security rules are already written for you)
4. Choose a location closest to you (e.g. `asia-south1` for India, `europe-west1` for Europe)
5. Click **Enable**

---

### Step 4 — Enable Authentication

1. In the Firebase console, click **"Authentication"** in the left menu
2. Click **"Get started"**
3. Click on **"Email/Password"**
   - Enable **"Email/Password"** (top toggle) → click **Save**
4. That's it — both admin and user login are now set up

> **How login works:**
> - Admin login uses **Email/Password** — admin enters their email and password (set up in Step 6b)
> - User login uses **Email/Password** internally — the username + PIN are converted to a secure credential automatically. Users never see or type an email address.

---

### Step 5 — Register Your Web App and Get Config

1. On the Firebase console home page, click the **`</>`** (web) icon
2. Give your app a nickname, e.g. `shop-invoice-web`
3. Check **"Also set up Firebase Hosting"** ← important, this sets up your free website
4. Click **"Register app"**
5. You will see a block of code that looks like this — **copy all of it**:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "my-project.firebaseapp.com",
  projectId:         "my-project",
  storageBucket:     "my-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123",
};
```

6. Open `frontend/src/firebase/config.js` in this project
7. Replace the placeholder values with your real values (keep the quotes)
8. Click **"Next"** and **"Continue to console"** in Firebase — we'll run the deploy command ourselves later

---

### Step 6 — Add Your First Admin

This has two parts: creating a Firebase Auth account for the admin, and adding their email to the `admins` Firestore collection.

**Part A — Create the admin's Firebase Auth account**

1. Go to Firebase Console → **Authentication** → **"Users"** tab
2. Click **"Add user"**
3. Enter the admin's email address and a temporary password
4. Click **"Add user"**

**Part B — Add the admin's email to Firestore**

The `admins` collection controls who is allowed admin access. Even if someone has a Firebase Auth account, they cannot log in as admin unless their email is in this collection.

1. Go to Firebase Console → **Firestore Database** → **"+ Start collection"**
2. Collection ID: `admins` → click **Next**
3. For **Document ID**: type your email address exactly, e.g. `yourname@gmail.com`
4. Add one field:
   - Field name: `name` | Type: string | Value: `Your Name`
5. Click **Save**

To add more admins later, repeat both parts for each new admin email. To add more documents to the `admins` collection, click the collection → **"+ Add document"**, using their email as the document ID.

---

### Step 7 — Install Node.js

Node.js is needed to build the app and run Firebase tools.

1. Go to [nodejs.org](https://nodejs.org)
2. Download the **LTS** version and install it
3. To verify: open a terminal and type `node --version` — you should see something like `v20.x.x`

---

### Step 8 — Install Firebase CLI

The Firebase CLI is a command-line tool that deploys your app to Firebase.

Open a terminal and run:
```bash
npm install -g firebase-tools
```

Then log in with your Google account:
```bash
firebase login
```

A browser window will open — sign in and allow access.

---

### Step 9 — Link This Project to Your Firebase Project

Open `.firebaserc` in this project folder and replace `YOUR_FIREBASE_PROJECT_ID` with your actual project ID.

Your project ID is shown in Firebase Console → click the gear icon ⚙️ → **"Project settings"** → it is listed under **"Project ID"**. It looks like `bigbasket-d55a2` (not the project name — the ID).

```json
{
  "projects": {
    "default": "bigbasket-d55a2"
  }
}
```

---

---

### Step 11 — Deploy

Open a terminal, navigate to the `shop-invoice-app` folder, and run:

```bash
bash deploy.sh
```

This will:
1. Install frontend dependencies (`npm install`)
2. Build the React app (`npm run build`)
3. Deploy the website and Firestore security rules to Firebase

After it finishes, you will see a **Hosting URL** like:
```
https://bigbasket-d55a2.web.app
```

Open that URL in your browser — your app is live! 🎉

---

## Running Locally (for development / testing)

If you want to test the app on your own computer before deploying:

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

The app talks directly to your real Firebase project even locally, so make sure you have completed Steps 2–5 and added your Firebase config to `frontend/.env` before running locally.

---

## How to Use the App

### Admin Login
1. Go to your app URL → click **"Admin"**
2. Enter your email address and password (set up in Step 6)
3. Click **"Sign In"** — you are now on the Admin Dashboard

> **Forgot your password?** Enter your email, then click **"Forgot password?"** — Firebase will send a reset link to your inbox.

### Creating a Shop User (as Admin)
1. Log in as Admin → click **"Users"** in the sidebar
2. Click **"+ New User"**
3. Fill in: Full Name, Username, Shop Name, Phone Number, PIN (4 digits)
4. Click **"Create User"**
5. Share the username and PIN with that person so they can log in

### User Login
1. Go to your app URL → click **"Shop User"**
2. Enter the username and PIN that the admin set up for you
3. Click **"Sign In"** → you are now on the Invoice Upload page

### Uploading an Invoice
1. Log in as a User → you are already on the Upload page
2. Either drag and drop a PDF or image onto the upload area, or click **"Manual Entry"**
3. If you upload a file: the app reads it in your browser and tries to fill in the fields automatically
4. Review all the fields — correct anything that was extracted incorrectly
5. Click **"Save Invoice"** — the invoice details are saved to the database

---

## Project Structure

```
shop-invoice-app/
├── README.md                          ← This file
├── firebase.json                      ← Firebase project configuration
├── .firebaserc                        ← ⚠️  Put your Firebase project ID here
├── firestore.rules                    ← Database security rules (already written)
├── firestore.indexes.json             ← Firestore index definitions
├── deploy.sh                          ← One-command deploy script
├── seed-admin.sh                      ← Helper script to add an admin
└── frontend/                          ← The entire React web app
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx                   ← Entry point
        ├── App.jsx                    ← Routes
        ├── firebase/
        │   └── config.js             ← ⚠️  Put your Firebase config here
        ├── contexts/
        │   └── AuthContext.jsx        ← Manages who is logged in
        ├── components/
        │   ├── LoadingSpinner.jsx
        │   ├── Toast.jsx              ← Success/error messages
        │   └── ProtectedRoute.jsx     ← Blocks pages if not logged in
        ├── pages/
        │   ├── RoleSelection.jsx      ← Home page (Admin or User?)
        │   ├── AdminLogin.jsx         ← Admin magic link login
        │   ├── UserLogin.jsx          ← Username + PIN login
        │   ├── AdminDashboard.jsx     ← Admin home with stats
        │   ├── UserManagement.jsx     ← Create/edit/disable users
        │   ├── InvoiceUpload.jsx      ← Upload or manually enter invoice
        │   ├── InvoiceList.jsx        ← View all invoices
        │   └── AuditLogs.jsx          ← View action history
        ├── utils/
        │   ├── hashPin.js             ← SHA-256 PIN hashing (browser built-in)
        │   ├── ocrProcessor.js        ← Extract text from PDFs/images locally
        │   └── auditLogger.js         ← Writes audit events to Firestore
        └── styles/
            └── main.css               ← All styles, plain CSS
```

---

## Firestore Data Structure

```
admins/                     ← Who can log in as admin
  {email}/                  ← Document ID is the email address, e.g. "you@gmail.com"
    name: string

users/                      ← Shop users created by admin
  {firebase-auth-uid}/      ← Document ID is the Firebase Auth user ID (set automatically)
    fullName: string
    username: string         ← Unique, lowercase
    shopName: string
    phone: string
    status: "active" | "inactive" | "deleted"
    createdBy: string        ← Admin's Firebase Auth UID
    createdAt: timestamp

invoices/                   ← Invoice records
  {auto-id}/
    invoiceNumber: string
    vendorName: string
    invoiceDate: string
    taxId: string
    amount: number
    tax: number
    total: number
    currency: string         ← e.g. "INR", "USD"
    createdBy: string        ← Firebase Auth UID of the user who saved it
    shopName: string
    createdAt: timestamp

auditLogs/                  ← Record of all important actions
  {auto-id}/
    action: string           ← e.g. "USER_CREATED", "INVOICE_UPLOADED", "USER_DISABLED"
    performedBy: string      ← Firebase Auth UID
    targetId: string         ← ID of the affected document (if any)
    details: object          ← Extra context (username, invoice number, etc.)
    timestamp: timestamp
```

---

## Troubleshooting

**Admin can't log in — "Incorrect email or password"**
- Make sure you created a Firebase Auth account for this email (Step 6, Part A)
- Make sure the email is in the Firestore `admins` collection (Step 6, Part B)
- Use **"Forgot password?"** on the login page to reset the password via email

**Admin logs in but is immediately redirected back to home**
- The Firebase Auth account exists but the email is not in the Firestore `admins` collection
- Go to Firebase Console → Firestore → `admins` collection and add a document with the email as the Document ID (see Step 6, Part B)

**User can't log in — "Invalid username or PIN"**
- Double-check the username (lowercase, no spaces)
- The PIN must match exactly what was set by the admin
- If the user's account is set to Inactive, they cannot log in — the admin must re-enable them

**OCR doesn't extract the invoice data correctly**
- OCR works best on clear, high-resolution images with good contrast
- Scanned or photographed invoices may have lower accuracy
- All extracted fields are editable — just correct anything that looks wrong before saving

**Deployment fails**
- Make sure you ran `firebase login` and are signed in to the correct Google account
- Make sure the project ID in `.firebaserc` matches exactly what is shown in Firebase Console → Project Settings
- Make sure Node.js 18 or newer is installed (`node --version`)

**"permission-denied" error when using the app**
- Make sure Firestore is in production mode and the rules were deployed (`bash deploy.sh` handles this)
- Make sure you are fully logged in — try signing out and signing back in

---

## Costs

**Monthly cost: $0.00 — no credit card ever required.**

This app uses only:
- Firebase **Authentication** — free (up to 10,000 users/month)
- Firebase **Firestore** — free (up to 1 GB storage, 50,000 reads/day)
- Firebase **Hosting** — free (up to 10 GB/month bandwidth)

For a typical small shop with a handful of users and dozens of invoices per month, you will use a tiny fraction of these limits.

---

## Security Notes

- **Admin login:** Uses Firebase Email/Password — password is hashed and stored by Firebase (never visible to us). Admins can reset their password at any time via the login page.
- **User PINs:** Hashed with SHA-256 + a per-user salt in the browser before being sent anywhere — the plain PIN is never stored or transmitted
- **Data access:** Firestore security rules ensure users can only read and write their own invoices — they cannot see other users' data
- **File processing:** Invoice files (PDF/images) are processed entirely in the browser — they are never uploaded to any server
- **No server-side code:** The app has no backend server to maintain or secure — Firebase services handle all the infrastructure

---

## Upgrading Later (Optional)

If you ever want to add features that require a server (like sending emails directly, or storing uploaded files online), you can upgrade to the Firebase **Blaze plan** at any time. The Blaze plan is pay-as-you-go but gives you the same free limits — you only pay if you go beyond them, and for small usage the cost remains $0.

Everything in this app is designed to make that upgrade easy when you are ready.
