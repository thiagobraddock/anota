import { randomUUID } from "crypto";

const COOKIE_NAME = "anota_device_id";
const COOKIE_MAX_AGE_MS = 2 * 365 * 24 * 60 * 60 * 1000; // 2 years

// Identifies "this computer" with a cookie set by the server, so a note's
// edit access survives clearing the browser's localStorage/cache (which
// commonly wipes localStorage but leaves cookies intact). Falls back to the
// legacy X-Device-Id header for notes created before this cookie existed.
export function deviceIdMiddleware(req, res, next) {
  let deviceId = req.cookies?.[COOKIE_NAME];

  if (!deviceId) {
    deviceId = randomUUID();
    res.cookie(COOKIE_NAME, deviceId, {
      maxAge: COOKIE_MAX_AGE_MS,
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  req.deviceId = deviceId;
  req.legacyDeviceId = req.headers["x-device-id"] || null;
  next();
}
