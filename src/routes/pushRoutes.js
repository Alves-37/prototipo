const express = require('express');
const router = express.Router();
const pushController = require('../controllers/pushController');
const { authMiddleware } = require('../middlewares/auth');

// Obter chave pública VAPID (público)
router.get('/public-key', pushController.getPublicKey);

// Rotas protegidas
router.post('/subscribe', authMiddleware, pushController.subscribe);
router.post('/unsubscribe', authMiddleware, pushController.unsubscribe);

module.exports = router;
