const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authMiddleware } = require('../middlewares/auth');

// Todas as rotas precisam de autenticação
router.use(authMiddleware);

// Rotas de usuário
router.get('/:id', userController.buscarPorId);
router.put('/:id', userController.atualizar);
router.delete('/:id', userController.excluir);

module.exports = router; 