const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { User } = require('../models');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

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
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        const nome = profile.displayName || (profile.name ? `${profile.name.givenName || ''} ${profile.name.familyName || ''}`.trim() : 'Usuário Google');
        if (!email) {
          return done(null, false, { message: 'Email não disponível no perfil do Google' });
        }

        let user = await User.findOne({ where: { email } });
        if (!user) {
          // Recuperar o tipo desejado enviado como state (usuario|empresa)
          const rawState = req?.query?.state;
          const tipoDesejado = (rawState === 'empresa' ? 'empresa' : 'usuario');
          console.log('[OAuth][Google] Criando usuário novo:', { email, rawState, tipoDesejado });
          // Criar senha aleatória (hash) para cumprir restrição de NOT NULL/validação
          const tempPass = crypto.randomBytes(16).toString('hex');
          const hash = await bcrypt.hash(tempPass, 10);
          // Criar novo usuário do tipo candidato por padrão
          user = await User.create({
            nome,
            email,
            senha: hash,
            tipo: tipoDesejado,
          });
        }

        return done(null, user);
      } catch (err) {
        console.error('[OAuth][Google] Erro no verify:', err);
        return done(err);
      }
    }
  )
);

module.exports = passport;
