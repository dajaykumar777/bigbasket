/**
 * hashPin.js
 *
 * Hashes a PIN using the browser's built-in Web Crypto API (SHA-256).
 * The plain PIN never leaves the browser — we only send the hash to the server.
 */

/**
 * Returns the SHA-256 hex string of the given input string.
 * @param {string} text
 * @returns {Promise<string>} hex-encoded SHA-256 hash
 */
async function sha256(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a user's PIN before sending it to the server.
 * We prepend a fixed app-level salt so that a PIN of "1234" for this
 * app produces a different hash than "1234" elsewhere.
 *
 * @param {string} pin  - 4 digit PIN
 * @param {string} username - username (acts as per-user salt)
 * @returns {Promise<string>} 64-character hex hash
 */
export async function hashPin(pin, username) {
  const APP_SALT = 'shop-invoice-app-v1';
  const combined = `${APP_SALT}:${username.toLowerCase()}:${pin}`;
  return sha256(combined);
}
