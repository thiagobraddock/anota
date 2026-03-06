import { Router } from 'express'
import bcrypt from 'bcrypt'
import pool from '../db.js'

const router = Router()

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/
const RESERVED_SLUGS = ['api', 'login', 'register', 'admin', 'settings', 'quick-note', 'about', 'terms', 'privacy']

function isValidSlug(slug) {
  if (!slug || slug.length < 2 || slug.length > 64) return false
  if (RESERVED_SLUGS.includes(slug)) return false
  if (slug.includes('--')) return false
  return SLUG_REGEX.test(slug)
}

function checkOwner(req, note) {
  // Logged-in user matches owner_id
  if (req.user && note.owner_id && note.owner_id === req.user.id) return true
  // Anonymous creator_token matches
  const token = req.headers['x-creator-token']
  if (token && note.creator_token && note.creator_token === token) return true
  return false
}

// GET /api/notes/:slug
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Slug invalido' })
    }

    const result = await pool.query(
      'SELECT id, slug, content, owner_id, creator_token, access_mode, password_hash IS NOT NULL as has_password, created_at, updated_at FROM notes WHERE slug = $1',
      [slug]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nota nao encontrada' })
    }

    const note = result.rows[0]

    // Update last_accessed_at
    await pool.query('UPDATE notes SET last_accessed_at = NOW() WHERE id = $1', [note.id])

    const is_owner = checkOwner(req, note)
    const can_edit = note.access_mode === 'open' || is_owner

    // If note has password and user hasn't verified, don't send content
    if (note.has_password) {
      const sessionKey = `note_verified_${note.id}`
      if (!req.session[sessionKey]) {
        return res.json({
          slug: note.slug,
          has_password: true,
          needs_password: true,
          owner_id: note.owner_id,
          access_mode: note.access_mode,
          is_owner,
          can_edit,
          created_at: note.created_at,
        })
      }
    }

    res.json({
      slug: note.slug,
      content: note.content,
      has_password: note.has_password,
      needs_password: false,
      owner_id: note.owner_id,
      access_mode: note.access_mode,
      is_owner,
      can_edit,
      created_at: note.created_at,
      updated_at: note.updated_at,
    })
  } catch (err) {
    console.error('GET /notes/:slug error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// PUT /api/notes/:slug - Create or update
router.put('/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    const { content } = req.body

    if (!isValidSlug(slug)) {
      return res.status(400).json({ error: 'Slug invalido' })
    }

    // Check if note exists
    const existing = await pool.query(
      'SELECT id, owner_id, creator_token, access_mode, password_hash IS NOT NULL as has_password FROM notes WHERE slug = $1',
      [slug]
    )

    if (existing.rows.length === 0) {
      // Create new note
      // Check user's note limit if logged in
      if (req.user) {
        const userNotes = await pool.query('SELECT COUNT(*) FROM notes WHERE owner_id = $1', [req.user.id])
        const count = parseInt(userNotes.rows[0].count)
        if (req.user.plan === 'free' && count >= 20) {
          return res.status(403).json({ error: 'Limite de notas atingido (20). Faca upgrade para Pro.' })
        }
      }

      const result = await pool.query(
        'INSERT INTO notes (slug, content, owner_id) VALUES ($1, $2, $3) RETURNING id, slug, creator_token, access_mode, created_at, updated_at',
        [slug, JSON.stringify(content), req.user?.id || null]
      )
      return res.status(201).json(result.rows[0])
    }

    const note = existing.rows[0]

    // Permission check: if private, only owner can update
    if (note.access_mode === 'private' && !checkOwner(req, note)) {
      return res.status(403).json({ error: 'Nota privada. Apenas o criador pode editar.' })
    }

    // If note has password, verify session
    if (note.has_password) {
      const sessionKey = `note_verified_${note.id}`
      if (!req.session[sessionKey]) {
        return res.status(403).json({ error: 'Senha necessaria' })
      }
    }

    // Update note
    const result = await pool.query(
      'UPDATE notes SET content = $1, updated_at = NOW(), last_accessed_at = NOW() WHERE slug = $2 RETURNING id, slug, updated_at',
      [JSON.stringify(content), slug]
    )
    res.json(result.rows[0])
  } catch (err) {
    console.error('PUT /notes/:slug error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// DELETE /api/notes/:slug
router.delete('/:slug', async (req, res) => {
  try {
    const { slug } = req.params

    // Fetch note to check ownership
    const existing = await pool.query('SELECT id, owner_id, creator_token FROM notes WHERE slug = $1', [slug])
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Nota nao encontrada' })
    }

    if (!checkOwner(req, existing.rows[0])) {
      return res.status(403).json({ error: 'Apenas o criador pode excluir essa nota.' })
    }

    await pool.query('DELETE FROM notes WHERE slug = $1', [slug])
    res.json({ success: true })
  } catch (err) {
    console.error('DELETE /notes/:slug error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// POST /api/notes/:slug/password
router.post('/:slug/password', async (req, res) => {
  try {
    const { slug } = req.params
    const { password } = req.body

    const note = await pool.query('SELECT id, owner_id, creator_token FROM notes WHERE slug = $1', [slug])
    if (note.rows.length === 0) {
      return res.status(404).json({ error: 'Nota nao encontrada' })
    }

    if (!checkOwner(req, note.rows[0])) {
      return res.status(403).json({ error: 'Apenas o criador pode alterar a senha.' })
    }

    if (password) {
      const hash = await bcrypt.hash(password, 10)
      await pool.query('UPDATE notes SET password_hash = $1, updated_at = NOW() WHERE slug = $2', [hash, slug])
      // Auto-verify for current session
      req.session[`note_verified_${note.rows[0].id}`] = true
    } else {
      // Remove password
      await pool.query('UPDATE notes SET password_hash = NULL, updated_at = NOW() WHERE slug = $1', [slug])
    }

    res.json({ success: true })
  } catch (err) {
    console.error('POST /notes/:slug/password error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// POST /api/notes/:slug/verify-password
router.post('/:slug/verify-password', async (req, res) => {
  try {
    const { slug } = req.params
    const { password } = req.body

    const result = await pool.query('SELECT id, password_hash FROM notes WHERE slug = $1', [slug])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Nota nao encontrada' })
    }

    const note = result.rows[0]
    if (!note.password_hash) {
      return res.json({ success: true })
    }

    const valid = await bcrypt.compare(password, note.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Senha incorreta' })
    }

    // Mark as verified in session
    req.session[`note_verified_${note.id}`] = true
    res.json({ success: true })
  } catch (err) {
    console.error('POST /notes/:slug/verify-password error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// POST /api/notes/:slug/rename
router.post('/:slug/rename', async (req, res) => {
  try {
    const { slug } = req.params
    const { newSlug } = req.body

    if (!isValidSlug(newSlug)) {
      return res.status(400).json({ error: 'Novo slug invalido' })
    }

    // Fetch note to check ownership
    const note = await pool.query('SELECT id, owner_id, creator_token FROM notes WHERE slug = $1', [slug])
    if (note.rows.length === 0) {
      return res.status(404).json({ error: 'Nota nao encontrada' })
    }

    if (!checkOwner(req, note.rows[0])) {
      return res.status(403).json({ error: 'Apenas o criador pode renomear essa nota.' })
    }

    // Check if new slug is available
    const existing = await pool.query('SELECT id FROM notes WHERE slug = $1', [newSlug])
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Esse endereco ja esta em uso' })
    }

    const result = await pool.query(
      'UPDATE notes SET slug = $1, updated_at = NOW() WHERE slug = $2 RETURNING id, slug',
      [newSlug, slug]
    )

    res.json(result.rows[0])
  } catch (err) {
    console.error('POST /notes/:slug/rename error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// POST /api/notes/:slug/access-mode
router.post('/:slug/access-mode', async (req, res) => {
  try {
    const { slug } = req.params
    const { mode } = req.body

    if (!['open', 'private'].includes(mode)) {
      return res.status(400).json({ error: 'Modo invalido. Use "open" ou "private".' })
    }

    const note = await pool.query('SELECT id, owner_id, creator_token FROM notes WHERE slug = $1', [slug])
    if (note.rows.length === 0) {
      return res.status(404).json({ error: 'Nota nao encontrada' })
    }

    if (!checkOwner(req, note.rows[0])) {
      return res.status(403).json({ error: 'Apenas o criador pode alterar o modo de acesso.' })
    }

    await pool.query('UPDATE notes SET access_mode = $1, updated_at = NOW() WHERE slug = $2', [mode, slug])
    res.json({ success: true, access_mode: mode })
  } catch (err) {
    console.error('POST /notes/:slug/access-mode error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

export default router
