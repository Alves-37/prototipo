const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth');
const notificacaoController = require('../controllers/notificacaoController');

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Listar notificações do usuário
router.get('/', notificacaoController.listar);

// Contar não lidas
router.get('/count', notificacaoController.contarNaoLidas);

// Marcar uma notificação como lida
router.put('/:id/read', notificacaoController.marcarLida);

// Marcar todas como lidas
router.put('/read-all', notificacaoController.marcarTodas);

// Excluir uma notificação
router.delete('/:id', notificacaoController.excluir);

module.exports = router;
