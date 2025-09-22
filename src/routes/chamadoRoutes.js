const express = require('express');
const router = express.Router();
const chamadoController = require('../controllers/chamadoController');
const { authMiddleware } = require('../middlewares/auth');

console.log('=== DEBUG: Registrando rotas de chamados ===');

// Rotas públicas (apenas listagem e busca)
router.get('/', chamadoController.listar);

// Rota de teste para respostas (temporária)
router.get('/teste/respostas', chamadoController.testarRespostas);

// Rota de teste para verificar se as rotas estão funcionando
router.get('/teste/rotas', (req, res) => {
  res.json({ 
    message: 'Rotas de chamados funcionando',
    timestamp: new Date().toISOString(),
    routes: [
      'GET /',
      'GET /teste/respostas',
      'PUT /:id/concluir',
      'PUT /:id/fechar',
      'PUT /:id/reabrir'
    ]
  });
});

// Rotas protegidas (requer autenticação)
router.use(authMiddleware);

// CRUD de chamados
router.post('/', chamadoController.criar);

// Chamados do usuário (DEVEM vir antes das rotas com :id)
router.get('/usuario/meus', chamadoController.meusChamados);
router.get('/usuario/respostas', chamadoController.minhasRespostas);

// Gerenciamento de status do chamado (DEVEM vir antes das rotas com :id)
router.put('/:id/concluir', chamadoController.concluirChamado);
router.put('/:id/fechar', chamadoController.fecharChamado);
router.put('/:id/reabrir', chamadoController.reabrirChamado);

// Respostas (DEVEM vir antes das rotas com :id)
router.post('/:id/respostas', chamadoController.adicionarResposta);
router.put('/:chamadoId/respostas/:respostaId/aceitar', chamadoController.aceitarResposta);

// Favoritos (DEVEM vir antes das rotas com :id)
router.put('/:id/favorito', chamadoController.toggleFavorito);

// Rotas com parâmetros dinâmicos (DEVEM vir por último)
router.get('/:id', chamadoController.buscarPorId);
router.put('/:id', chamadoController.atualizar);
router.delete('/:id', chamadoController.excluir);

console.log('=== DEBUG: Rotas de chamados registradas ===');

module.exports = router; 