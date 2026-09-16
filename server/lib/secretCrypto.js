import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// Encrypts TOTP secrets at rest (AES-256-GCM) so a DB leak alone doesn't hand
// out working authenticator secrets. Key is derived from an env var so it
// isn't checked into source; SESSION_SECRET is an acceptable fallback in dev.
const KEY = scryptSync(
  process.env.TOTP_ENCRYPTION_KEY || process.env.SESSION_SECRET || "dev-secret-change-me",
  "anota-totp-salt",
  32,
);

export function encryptSecret(plainText) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((buf) => buf.toString("base64")).join(".");
}

export function decryptSecret(encoded) {
  const [ivB64, authTagB64, dataB64] = encoded.split(".");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const data = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
