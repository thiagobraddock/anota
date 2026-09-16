import { Router } from 'express'
import QRCode from 'qrcode'
import { generateSecret, generateURI, verify as verifyTotp } from 'otplib'
import { query } from '../db.js'
import { encryptSecret, decryptSecret } from '../lib/secretCrypto.js'
import { claimDeviceNotes } from '../lib/claimDeviceNotes.js'
import { isRateLimited } from '../lib/rateLimit.js'

const router = Router()
const TOTP_ISSUER = 'Anota'
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || '').toLowerCase().trim()

router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Nao autenticado' })
  }
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.name,
    avatar_url: req.user.avatar_url,
    plan: req.user.plan,
  })
})

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Erro ao sair' })
    req.session.destroy()
    res.json({ success: true })
  })
})

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function logInAndClaimNotes(req, res, user) {
  req.login(user, async (err) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao autenticar' })
    }

    await claimDeviceNotes(user.id, [req.deviceId, req.legacyDeviceId])

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar_url: user.avatar_url,
      plan: user.plan,
    })
  })
}

// POST /api/auth/totp/start - tells the client whether this email already
// has a code configured (show the code field) or needs first-time setup
// (show the QR code).
router.post('/totp/start', async (req, res) => {
  const { email } = req.body

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'E-mail invalido' })
  }

  if (isRateLimited(`totp-start:${req.ip}`, { max: 20, windowMs: 60_000 })) {
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde um pouco.' })
  }

  const result = await query('SELECT totp_enabled FROM users WHERE email = $1', [email])
  const enabled = result.rows.length > 0 && result.rows[0].totp_enabled
  res.json({ enabled })
})

// POST /api/auth/totp/setup - creates the account (or reuses an existing one
// that hasn't finished setup yet) and returns a QR code to scan into an
// authenticator app (e.g. Apple Passwords, Google Authenticator).
router.post('/totp/setup', async (req, res) => {
  try {
    const { email, name } = req.body

    if (!isValidEmail(email) || !name?.trim()) {
      return res.status(400).json({ error: 'Nome e e-mail sao obrigatorios' })
    }

    if (!ADMIN_EMAIL || email.toLowerCase() !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Cadastro fechado.' })
    }

    if (isRateLimited(`totp-setup:${req.ip}`, { max: 10, windowMs: 60_000 })) {
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde um pouco.' })
    }

    const existing = await query('SELECT id, totp_enabled FROM users WHERE email = $1', [email])

    if (existing.rows.length > 0 && existing.rows[0].totp_enabled) {
      return res.status(409).json({ error: 'Essa conta ja tem um codigo configurado. Use login.' })
    }

    const secret = generateSecret()
    const secretEnc = encryptSecret(secret)

    if (existing.rows.length > 0) {
      await query(
        'UPDATE users SET name = $1, totp_secret_enc = $2, is_admin = true WHERE id = $3',
        [name.trim(), secretEnc, existing.rows[0].id],
      )
    } else {
      await query(
        `INSERT INTO users (email, name, totp_secret_enc, is_admin)
         VALUES ($1, $2, $3, true)`,
        [email, name.trim(), secretEnc],
      )
    }

    const uri = generateURI({ issuer: TOTP_ISSUER, label: email, secret })
    const qr = await QRCode.toDataURL(uri)

    res.json({ qr, secret, email })
  } catch (err) {
    console.error('POST /auth/totp/setup error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// POST /api/auth/totp/confirm - first code typed right after scanning the QR,
// proves the authenticator app was set up correctly before enabling login.
router.post('/totp/confirm', async (req, res) => {
  try {
    const { email, code } = req.body

    if (!isValidEmail(email) || !code) {
      return res.status(400).json({ error: 'Dados invalidos' })
    }

    if (isRateLimited(`totp-confirm:${email}`, { max: 8, windowMs: 60_000 })) {
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde um pouco.' })
    }

    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND totp_secret_enc IS NOT NULL AND totp_enabled = false',
      [email],
    )

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Nenhuma configuracao pendente para esse e-mail' })
    }

    const user = result.rows[0]
    const secret = decryptSecret(user.totp_secret_enc)
    const { valid } = await verifyTotp({ secret, token: String(code) })

    if (!valid) {
      return res.status(401).json({ error: 'Codigo incorreto' })
    }

    await query('UPDATE users SET totp_enabled = true WHERE id = $1', [user.id])
    await logInAndClaimNotes(req, res, user)
  } catch (err) {
    console.error('POST /auth/totp/confirm error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// POST /api/auth/totp/login - everyday login: e-mail + the 6-digit code
// currently shown in the authenticator app, from any computer.
router.post('/totp/login', async (req, res) => {
  try {
    const { email, code } = req.body

    if (!isValidEmail(email) || !code) {
      return res.status(400).json({ error: 'Dados invalidos' })
    }

    if (isRateLimited(`totp-login:${email}`, { max: 8, windowMs: 60_000 })) {
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde um pouco.' })
    }

    const result = await query(
      'SELECT * FROM users WHERE email = $1 AND totp_enabled = true',
      [email],
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Conta nao encontrada ou sem codigo configurado' })
    }

    const user = result.rows[0]
    const secret = decryptSecret(user.totp_secret_enc)
    const { valid } = await verifyTotp({ secret, token: String(code) })

    if (!valid) {
      return res.status(401).json({ error: 'Codigo incorreto' })
    }

    await logInAndClaimNotes(req, res, user)
  } catch (err) {
    console.error('POST /auth/totp/login error:', err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

export default router
