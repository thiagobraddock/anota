import { Router } from "express";
import bcrypt from "bcrypt";
import { query } from "../db.js";
import {
  closeCollaborationRoom,
  getCollaboratorCount,
  getLiveNoteContent,
  persistLiveNoteContent,
} from "../websocket.js";

const router = Router();

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;
const RESERVED_SLUGS = [
  "api",
  "login",
  "register",
  "admin",
  "settings",
  "quick-note",
  "about",
  "terms",
  "privacy",
  "minhas-notas",
];

function isValidSlug(slug) {
  if (!slug || slug.length < 2 || slug.length > 64) return false;
  if (RESERVED_SLUGS.includes(slug)) return false;
  if (slug.includes("--")) return false;
  return SLUG_REGEX.test(slug);
}

// Check if request comes from the note owner (by device_id). Matches either
// the persistent cookie-based device id or the legacy localStorage-based
// X-Device-Id header, so notes created before the cookie existed still work.
function isOwner(req, note) {
  if (req.user && note.owner_id && req.user.id === note.owner_id) return true;
  if (!note.owner_device_id) return false;
  return (
    note.owner_device_id === req.deviceId ||
    (req.legacyDeviceId && note.owner_device_id === req.legacyDeviceId)
  );
}

// GET /api/notes - list the logged-in user's own notes
router.get("/", async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Nao autenticado" });
  }

  try {
    const result = await query(
      `SELECT slug, access_mode, password_hash IS NOT NULL as has_password,
              created_at, updated_at
       FROM notes WHERE owner_id = $1
       ORDER BY updated_at DESC`,
      [req.user.id],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("GET /notes error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/notes/:slug
router.get("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: "Slug invalido" });
    }

    const result = await query(
      `SELECT id, slug, content, owner_id, owner_device_id, access_mode, 
              password_hash IS NOT NULL as has_password, created_at, updated_at 
       FROM notes WHERE slug = $1`,
      [slug],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Nota nao encontrada" });
    }

    const note = result.rows[0];
    const is_owner = isOwner(req, note);

    // Update last_accessed_at
    await query(
      "UPDATE notes SET last_accessed_at = NOW() WHERE id = $1",
      [note.id],
    );

    // Check if note requires password
    if (note.has_password) {
      const sessionKey = `note_verified_${note.id}`;
      if (!req.session[sessionKey]) {
        return res.json({
          slug: note.slug,
          has_password: true,
          needs_password: true,
          access_mode: note.access_mode,
          is_owner,
          can_edit: false,
          created_at: note.created_at,
        });
      }
    }

    // Determine edit permissions:
    // - Private notes: only owner can edit
    // - Open notes: anyone can edit (via WebSocket collaboration)
    const can_edit = note.access_mode === "open" || is_owner;

    const liveContent =
      note.access_mode === "open" ? getLiveNoteContent(slug) : null;

    res.json({
      slug: note.slug,
      content: liveContent || note.content,
      has_password: note.has_password,
      needs_password: false,
      access_mode: note.access_mode,
      is_owner,
      can_edit,
      created_at: note.created_at,
      updated_at: note.updated_at,
    });
  } catch (err) {
    console.error("GET /notes/:slug error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// PUT /api/notes/:slug - Create or update
router.put("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const { content } = req.body;
    const deviceId = req.deviceId;

    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: "Slug invalido" });
    }

    // Check if note exists
    const existing = await query(
      `SELECT id, owner_id, owner_device_id, access_mode, 
              password_hash IS NOT NULL as has_password 
       FROM notes WHERE slug = $1`,
      [slug],
    );

    if (existing.rows.length === 0) {
      // Create new note - private by default, owned by this device
      if (req.user) {
        const userNotes = await query(
          "SELECT COUNT(*) FROM notes WHERE owner_id = $1",
          [req.user.id],
        );
        const count = parseInt(userNotes.rows[0].count);
        if (req.user.plan === "free" && count >= 20) {
          return res.status(403).json({
            error: "Limite de notas atingido (20). Faca upgrade para Pro.",
          });
        }
      }

      const result = await query(
        `INSERT INTO notes (slug, content, owner_id, owner_device_id, access_mode) 
         VALUES ($1, $2, $3, $4, 'private') 
         RETURNING id, slug, access_mode, created_at, updated_at`,
        [slug, JSON.stringify(content), req.user?.id || null, deviceId],
      );

      console.log(
        `✅ Created new note: ${slug} (private, device: ${deviceId.substring(0, 8)}...)`,
      );
      return res.status(201).json(result.rows[0]);
    }

    const note = existing.rows[0];

    // Permission check for existing notes:
    // - Private notes: only owner device can edit
    // - Open notes: anyone can edit via HTTP (or WebSocket)
    if (note.access_mode === "private" && !isOwner(req, note)) {
      return res.status(403).json({
        error: "Nota privada. Apenas o criador pode editar.",
      });
    }

    // If note has password, verify session
    if (note.has_password) {
      const sessionKey = `note_verified_${note.id}`;
      if (!req.session[sessionKey]) {
        return res.status(403).json({ error: "Senha necessaria" });
      }
    }

    // Update note
    const result = await query(
      `UPDATE notes SET content = $1, updated_at = NOW(), last_accessed_at = NOW() 
       WHERE slug = $2 
       RETURNING id, slug, updated_at`,
      [JSON.stringify(content), slug],
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("PUT /notes/:slug error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// DELETE /api/notes/:slug
router.delete("/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const existing = await query(
      "SELECT id, owner_id, owner_device_id FROM notes WHERE slug = $1",
      [slug],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Nota nao encontrada" });
    }

    if (!isOwner(req, existing.rows[0])) {
      return res.status(403).json({
        error: "Apenas o criador pode excluir essa nota.",
      });
    }

    await persistLiveNoteContent(slug);
    await query("DELETE FROM notes WHERE slug = $1", [slug]);
    closeCollaborationRoom(slug, 1008, "Note deleted");
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /notes/:slug error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/notes/:slug/password
router.post("/:slug/password", async (req, res) => {
  try {
    const { slug } = req.params;
    const { password } = req.body;

    const note = await query(
      "SELECT id, owner_id, owner_device_id FROM notes WHERE slug = $1",
      [slug],
    );

    if (note.rows.length === 0) {
      return res.status(404).json({ error: "Nota nao encontrada" });
    }

    if (!isOwner(req, note.rows[0])) {
      return res.status(403).json({
        error: "Apenas o criador pode alterar a senha.",
      });
    }

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await query(
        "UPDATE notes SET password_hash = $1, updated_at = NOW() WHERE slug = $2",
        [hash, slug],
      );
      req.session[`note_verified_${note.rows[0].id}`] = true;
    } else {
      await query(
        "UPDATE notes SET password_hash = NULL, updated_at = NOW() WHERE slug = $1",
        [slug],
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("POST /notes/:slug/password error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/notes/:slug/verify-password
router.post("/:slug/verify-password", async (req, res) => {
  try {
    const { slug } = req.params;
    const { password } = req.body;

    const result = await query(
      "SELECT id, password_hash FROM notes WHERE slug = $1",
      [slug],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Nota nao encontrada" });
    }

    const note = result.rows[0];
    if (!note.password_hash) {
      return res.json({ success: true });
    }

    const valid = await bcrypt.compare(password, note.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Senha incorreta" });
    }

    req.session[`note_verified_${note.id}`] = true;
    res.json({ success: true });
  } catch (err) {
    console.error("POST /notes/:slug/verify-password error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/notes/:slug/rename
router.post("/:slug/rename", async (req, res) => {
  try {
    const { slug } = req.params;
    const { newSlug } = req.body;

    if (!isValidSlug(newSlug)) {
      return res.status(400).json({ error: "Novo slug invalido" });
    }

    const note = await query(
      "SELECT id, owner_id, owner_device_id FROM notes WHERE slug = $1",
      [slug],
    );

    if (note.rows.length === 0) {
      return res.status(404).json({ error: "Nota nao encontrada" });
    }

    if (!isOwner(req, note.rows[0])) {
      return res.status(403).json({
        error: "Apenas o criador pode renomear essa nota.",
      });
    }

    const existing = await query("SELECT id FROM notes WHERE slug = $1", [
      newSlug,
    ]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Esse endereco ja esta em uso" });
    }

    await persistLiveNoteContent(slug);
    const result = await query(
      "UPDATE notes SET slug = $1, updated_at = NOW() WHERE slug = $2 RETURNING id, slug",
      [newSlug, slug],
    );

    closeCollaborationRoom(slug, 1008, "Note renamed");
    res.json(result.rows[0]);
  } catch (err) {
    console.error("POST /notes/:slug/rename error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /api/notes/:slug/access-mode - Toggle between private/open
router.post("/:slug/access-mode", async (req, res) => {
  try {
    const { slug } = req.params;
    const { mode } = req.body;

    if (!["open", "private"].includes(mode)) {
      return res.status(400).json({
        error: 'Modo invalido. Use "open" ou "private".',
      });
    }

    const note = await query(
      "SELECT id, owner_id, owner_device_id, access_mode FROM notes WHERE slug = $1",
      [slug],
    );

    if (note.rows.length === 0) {
      return res.status(404).json({ error: "Nota nao encontrada" });
    }

    if (!isOwner(req, note.rows[0])) {
      return res.status(403).json({
        error: "Apenas o criador pode alterar o modo de acesso.",
      });
    }

    if (mode === "private") {
      await persistLiveNoteContent(slug);
    }

    await query(
      "UPDATE notes SET access_mode = $1, updated_at = NOW() WHERE slug = $2",
      [mode, slug],
    );
    console.log(`🔄 Note ${slug} access mode changed to: ${mode}`);

    if (mode === "private") {
      closeCollaborationRoom(slug, 1008, "Note is now private");
    }

    res.json({ success: true, access_mode: mode });
  } catch (err) {
    console.error("POST /notes/:slug/access-mode error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /api/notes/:slug/collaborators - Get connected users count
router.get("/:slug/collaborators", async (req, res) => {
  try {
    const { slug } = req.params;
    res.json({ count: getCollaboratorCount(slug) });
  } catch (err) {
    console.error("GET /notes/:slug/collaborators error:", err);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
