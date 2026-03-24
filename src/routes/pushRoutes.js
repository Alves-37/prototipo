const express = require('express');
const router = express.Router();
const pushController = require('../controllers/pushController');
const { authMiddleware, optionalAuthMiddleware } = require('../middlewares/auth');

// Endpoints públicos (não exigem auth): permitem registrar browsers antes do login
router.post('/subscribe', optionalAuthMiddleware, pushController.subscribe);
router.post('/unsubscribe', optionalAuthMiddleware, pushController.unsubscribe);

// Endpoints autenticados (opcional): registrar associação userId-inscrição
router.post('/me/subscribe', authMiddleware, pushController.subscribe);
router.post('/me/unsubscribe', authMiddleware, pushController.unsubscribe);

// Teste (autenticado): envia uma notificação push para o próprio usuário
router.post('/test', authMiddleware, pushController.test);

module.exports = router;
