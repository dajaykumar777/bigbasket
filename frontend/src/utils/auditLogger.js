/**
 * auditLogger.js
 *
 * Client-side helper to write audit log entries to Firestore.
 * Most sensitive logs are written server-side (Cloud Functions),
 * but non-sensitive UI events (like invoice upload) are logged here.
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * @param {object} params
 * @param {string} params.action     - e.g. "INVOICE_UPLOADED"
 * @param {string} params.performedBy - Firebase Auth UID
 * @param {string} [params.targetId]  - optional document ID being affected
 * @param {object} [params.details]   - any extra info
 */
export async function logAction({ action, performedBy, performedByName = '', targetId = null, details = {} }) {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      action,
      performedBy,
      performedByName,
      targetId,
      details,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.warn('Audit log write failed:', err.message);
  }
}
