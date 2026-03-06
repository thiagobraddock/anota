import { Router } from 'express'
import passport from 'passport'

const router = Router()

router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
}))

router.get('/google/callback', passport.authenticate('google', {
  failureRedirect: '/?error=auth',
}), (req, res) => {
  res.redirect('/')
})

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

export default router
