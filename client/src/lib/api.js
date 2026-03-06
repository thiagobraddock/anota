const BASE = "/api";

const CREATOR_TOKENS_KEY = "anota_creator_tokens";
const LEGACY_TOKENS_KEY = "notepad666_creator_tokens";

// Migrate legacy localStorage key
try {
  const legacy = localStorage.getItem(LEGACY_TOKENS_KEY);
  if (legacy) {
    const existing = localStorage.getItem(CREATOR_TOKENS_KEY);
    if (!existing) {
      localStorage.setItem(CREATOR_TOKENS_KEY, legacy);
    } else {
      // Merge legacy into new
      const merged = { ...JSON.parse(legacy), ...JSON.parse(existing) };
      localStorage.setItem(CREATOR_TOKENS_KEY, JSON.stringify(merged));
    }
    localStorage.removeItem(LEGACY_TOKENS_KEY);
  }
} catch {
  /* ignore */
}

function getCreatorTokens() {
  try {
    return JSON.parse(localStorage.getItem(CREATOR_TOKENS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function getCreatorToken(slug) {
  return getCreatorTokens()[slug] || null;
}

export function setCreatorToken(slug, token) {
  const tokens = getCreatorTokens();
  tokens[slug] = token;
  localStorage.setItem(CREATOR_TOKENS_KEY, JSON.stringify(tokens));
}

export function renameCreatorToken(oldSlug, newSlug) {
  const tokens = getCreatorTokens();
  if (tokens[oldSlug]) {
    tokens[newSlug] = tokens[oldSlug];
    delete tokens[oldSlug];
    localStorage.setItem(CREATOR_TOKENS_KEY, JSON.stringify(tokens));
  }
}

export function removeCreatorToken(slug) {
  const tokens = getCreatorTokens();
  delete tokens[slug];
  localStorage.setItem(CREATOR_TOKENS_KEY, JSON.stringify(tokens));
}

function slugFromPath(path) {
  // Extract slug from paths like /notes/my-slug or /notes/my-slug/password
  const match = path.match(/^\/notes\/([^/]+)/);
  return match ? match[1] : null;
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };

  // Auto-attach creator token for note-related requests
  const slug = slugFromPath(path);
  if (slug) {
    const token = getCreatorToken(slug);
    if (token) {
      headers["X-Creator-Token"] = token;
    }
  }

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
  saveNote: async (slug, content) => {
    const data = await request(`/notes/${slug}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
    // If note was just created (201), save the creator_token
    if (data.creator_token) {
      setCreatorToken(slug, data.creator_token);
    }
    return data;
  },
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
