import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import pool from '../db.js'

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/auth/google/callback',
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value
      const name = profile.displayName
      const avatarUrl = profile.photos?.[0]?.value || null
      const googleId = profile.id

      // Upsert user
      const result = await pool.query(
        `INSERT INTO users (email, name, avatar_url, google_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (google_id) DO UPDATE SET
           name = EXCLUDED.name,
           avatar_url = EXCLUDED.avatar_url,
           updated_at = NOW()
         RETURNING *`,
        [email, name, avatarUrl, googleId]
      )

      done(null, result.rows[0])
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
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id])
    done(null, result.rows[0] || null)
  } catch (err) {
    done(err)
  }
})
