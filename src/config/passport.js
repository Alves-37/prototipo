const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { User } = require('../models');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/auth/google/callback';

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn('Google OAuth: CLIENT_ID/CLIENT_SECRET não configurados. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env');
}

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID || 'placeholder',
      clientSecret: GOOGLE_CLIENT_SECRET || 'placeholder',
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        const nome = profile.displayName || (profile.name ? `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim() : 'Usuário Google');
        if (!email) {
          return done(null, false, { message: 'Email não disponível no perfil do Google' });
        }

        let user = await User.findOne({ where: { email } });
        if (!user) {
          // Criar novo usuário do tipo candidato por padrão
          user = await User.create({
            nome,
            email,
            senha: '', // senha vazia, login via Google
            tipo: 'usuario',
          });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

module.exports = passport;
