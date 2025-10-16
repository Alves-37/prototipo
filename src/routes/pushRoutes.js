const express = require('express');
const router = express.Router();
const pushController = require('../controllers/pushController');
const { authMiddleware } = require('../middlewares/auth');

// Endpoints públicos (não exigem auth): permitem registrar browsers antes do login
router.post('/subscribe', pushController.subscribe);
router.post('/unsubscribe', pushController.unsubscribe);

// Endpoints autenticados (opcional): registrar associação userId-inscrição
router.post('/me/subscribe', authMiddleware, pushController.subscribe);
router.post('/me/unsubscribe', authMiddleware, pushController.unsubscribe);

module.exports = router;
