const BASE = "/api";

const DEVICE_ID_KEY = "anota_device_id";

// Get or create a unique device ID for this browser/device
export function getDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    "X-Device-Id": getDeviceId(),
    ...options.headers,
  };

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

export const api = {
  // Notes
  getNote: (slug) => request(`/notes/${slug}`),
  saveNote: (slug, content) =>
    request(`/notes/${slug}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  deleteNote: (slug) => request(`/notes/${slug}`, { method: "DELETE" }),
  setPassword: (slug, password) =>
    request(`/notes/${slug}/password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  verifyPassword: (slug, password) =>
    request(`/notes/${slug}/verify-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  renameNote: (slug, newSlug) =>
    request(`/notes/${slug}/rename`, {
      method: "POST",
      body: JSON.stringify({ newSlug }),
    }),
  setAccessMode: (slug, mode) =>
    request(`/notes/${slug}/access-mode`, {
      method: "POST",
      body: JSON.stringify({ mode }),
    }),

  // Auth
  getMe: () => request("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }),
};
