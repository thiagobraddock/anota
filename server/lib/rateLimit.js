// Minimal in-memory throttle for TOTP verification attempts. A 6-digit code
// has only 1e6 combinations, so login/confirm endpoints need to reject
// rapid guessing even though this is a single-instance app with no Redis.
const attempts = new Map();

export function isRateLimited(key, { max = 5, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count += 1;
  return entry.count > max;
}
