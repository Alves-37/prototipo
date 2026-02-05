const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('passport');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});

router.post('/register', authController.register);
router.post('/login', loginLimiter, authController.login);

// Google OAuth (inicia fluxo) - permite passar tipo via query (?tipo=empresa|usuario)
router.get('/google', (req, res, next) => {
  const tipo = (req.query.tipo === 'empresa' ? 'empresa' : 'usuario');
  return passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: tipo,
    session: false,
  })(req, res, next);
});

router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: (process.env.FRONTEND_URL || 'http://localhost:5173') + '/login?error=google'
  }),
  authController.googleCallback
);

module.exports = router;