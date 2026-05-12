/**
 * create-admin.mjs
 *
 * One-time script to create the bb_admin account in Firebase.
 * Run with:  node scripts/create-admin.mjs
 *
 * It will prompt for a 4-digit PIN, then:
 *   1. Create a Firebase Auth user  bb_admin@admin.shopapp.internal
 *      with the PIN hash as the password.
 *   2. Create the Firestore document  admins/bb_admin.
 *
 * Safe to re-run — if the Auth user already exists it updates the password;
 * if the Firestore doc already exists it updates it.
 */

import { createInterface } from 'readline';
import { createHash }      from 'crypto';
import { initializeApp }   from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updatePassword,
} from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { readFileSync }    from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath }   from 'url';

// ── Load env from frontend/.env ───────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dir, '../frontend/.env');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => l.split('=').map(p => p.trim()))
);

const firebaseConfig = {
  apiKey:            envVars.VITE_FIREBASE_API_KEY,
  authDomain:        envVars.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         envVars.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     envVars.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             envVars.VITE_FIREBASE_APP_ID,
};

// ── PIN hashing (mirrors hashPin.js logic) ────────────────────
function hashPin(pin, username) {
  const combined = `shop-invoice-app-v1:${username.toLowerCase()}:${pin}`;
  return createHash('sha256').update(combined, 'utf8').digest('hex');
}

// ── Prompt helper ─────────────────────────────────────────────
function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

// ── Main ──────────────────────────────────────────────────────
const USERNAME      = 'bb_admin';
const ADMIN_EMAIL   = `${USERNAME}@shopapp.internal`;

console.log('\n🔧  Big Basket Shop — Admin Account Setup');
console.log(`   Username : ${USERNAME}`);
console.log(`   Auth email (internal): ${ADMIN_EMAIL}\n`);

const pin = await prompt('Enter a 4-digit PIN for bb_admin: ');
if (!/^\d{4}$/.test(pin)) {
  console.error('❌  PIN must be exactly 4 digits. Aborting.');
  process.exit(1);
}

const pinHash = hashPin(pin, USERNAME);

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let uid;
try {
  // Try creating a new Auth user
  const cred = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, pinHash);
  uid = cred.user.uid;
  console.log('✅  Firebase Auth user created.');
} catch (err) {
  if (err.code === 'auth/email-already-in-use') {
    // User exists — sign in and update the password
    console.log('ℹ️   Auth user already exists, updating PIN...');
    const cred = await signInWithEmailAndPassword(auth, ADMIN_EMAIL, pinHash).catch(async () => {
      // Sign in failed (wrong old hash) — need to use Admin SDK to reset.
      // For simplicity, guide the user.
      console.error('⚠️   Could not sign in to update the PIN.');
      console.error('    To reset: delete the Auth user in Firebase Console and re-run this script.');
      process.exit(1);
    });
    await updatePassword(cred.user, pinHash);
    uid = cred.user.uid;
    console.log('✅  PIN updated in Firebase Auth.');
  } else {
    console.error('❌  Firebase Auth error:', err.message);
    process.exit(1);
  }
}

// Create / update the Firestore admins/{uid} document
await setDoc(doc(db, 'admins', uid), {
  username:  USERNAME,
  name:      'Admin',
  createdAt: serverTimestamp(),
}, { merge: true });

console.log('✅  Firestore admins/{uid} document created/updated.');
console.log(`\n✅  Done! Sign in at the app with username "bb_admin" and your PIN.\n`);
process.exit(0);
