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

// Marcar que o usuário contactou o suporte (cancela exclusão automática)
router.post('/:id/support-contacted', userController.marcarSuporteContactado);

// Certificações
router.get('/:id/certificacoes', userController.getCertificacoes);
router.post('/:id/certificacoes', userController.addCertificacao);
router.delete('/:id/certificacoes/:certId', userController.deleteCertificacao);

// Projetos
router.get('/:id/projetos', userController.getProjetos);
router.post('/:id/projetos', userController.addProjeto);
router.delete('/:id/projetos/:projetoId', userController.deleteProjeto);

// Estatísticas
router.get('/:id/estatisticas', userController.getEstatisticas);

module.exports = router;