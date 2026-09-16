import { query } from "../db.js";

// Links notes created anonymously on this browser (identified only by the
// device cookie/legacy header) to the account that just logged in, so
// logging in on a device that already has notes doesn't strand them.
export async function claimDeviceNotes(userId, deviceIds) {
  const ids = [...new Set(deviceIds.filter(Boolean))];
  if (ids.length === 0) return;

  await query(
    `UPDATE notes SET owner_id = $1
     WHERE owner_id IS NULL AND owner_device_id = ANY($2::text[])`,
    [userId, ids],
  );
}
