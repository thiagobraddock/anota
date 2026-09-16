import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { query } from '../db.js'
import { claimDeviceNotes } from '../lib/claimDeviceNotes.js'

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback',
    passReqToCallback: true,
  }, async (req, accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value
      const name = profile.displayName
      const avatarUrl = profile.photos?.[0]?.value || null
      const googleId = profile.id

      // Upsert user by email: Google proves ownership of this address, so a
      // Google login always wins/attaches to whatever account already used
      // that email (e.g. one created via the TOTP flow without a google_id
      // yet), instead of colliding with the email's UNIQUE constraint.
      const result = await query(
        `INSERT INTO users (email, name, avatar_url, google_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE SET
           name = EXCLUDED.name,
           avatar_url = EXCLUDED.avatar_url,
           google_id = EXCLUDED.google_id,
           updated_at = NOW()
         RETURNING *`,
        [email, name, avatarUrl, googleId]
      )

      const user = result.rows[0]
      await claimDeviceNotes(user.id, [req.deviceId, req.legacyDeviceId])
      done(null, user)
    } catch (err) {
      done(err)
    }
  }))
}

passport.serializeUser((user, done) => {
  done(null, user.id)
})

passport.deserializeUser(async (id, done) => {
  try {
    const result = await query('SELECT * FROM users WHERE id = $1', [id])
    done(null, result.rows[0] || null)
  } catch (err) {
    done(err)
  }
})
