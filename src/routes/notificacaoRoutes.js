const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth');
const notificacaoController = require('../controllers/notificacaoController');

// Todas as rotas exigem autenticação
router.use(authMiddleware);

// GET /api/notificacoes
router.get('/', notificacaoController.listar);

// PUT /api/notificacoes/:id/lida
router.put('/:id/lida', notificacaoController.marcarComoLida);

// PUT /api/notificacoes/lidas
router.put('/lidas', notificacaoController.marcarTodasComoLidas);

// DELETE /api/notificacoes
router.delete('/', notificacaoController.limpar);

// DELETE /api/notificacoes/:id
router.delete('/:id', notificacaoController.remover);

module.exports = router;
