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

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers,
      ...options,
    });
  } catch {
    throw {
      status: 0,
      error:
        "API local indisponivel. Inicie o backend e o Postgres com npm run dev:docker.",
    };
  }

  const text = await res.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      error:
        res.status >= 500
          ? "API local indisponivel. Verifique se o backend esta rodando na porta 3000."
          : "Resposta invalida da API.",
    };
  }

  if (res.status >= 500 && !data.error) {
    data.error =
      "API local indisponivel. Verifique se o backend esta rodando na porta 3000.";
  }

  if (!res.ok) throw { status: res.status, ...data };
  return data;
}

export const api = {
  // Notes
  listMyNotes: () => request(`/notes`),
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

  // Auth - TOTP (code from an authenticator app, e.g. Apple Passwords)
  totpStart: (email) =>
    request("/auth/totp/start", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  totpSetup: (email, name) =>
    request("/auth/totp/setup", {
      method: "POST",
      body: JSON.stringify({ email, name }),
    }),
  totpConfirm: (email, code) =>
    request("/auth/totp/confirm", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),
  totpLogin: (email, code) =>
    request("/auth/totp/login", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),
};
