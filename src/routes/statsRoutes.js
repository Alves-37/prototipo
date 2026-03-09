const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const { authMiddleware } = require('../middlewares/auth');

// Rota pública para obter estatísticas
router.get('/', statsController.getStats);

// Rota protegida para obter estatísticas do usuário logado
router.get('/user', authMiddleware, statsController.getUserStats);

module.exports = router;
