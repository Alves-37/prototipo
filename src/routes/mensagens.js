const express = require('express');
const router = express.Router();
const mensagemController = require('../controllers/mensagemController');
const { authMiddleware } = require('../middlewares/auth');

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Listar conversas do usuário
router.get('/conversas', mensagemController.listarConversas);

// Obter mensagens de uma conversa
router.get('/conversa/:conversaId', mensagemController.obterMensagens);

// Enviar mensagem
router.post('/enviar', mensagemController.enviarMensagem);

// Marcar mensagens como lidas
router.put('/conversa/:conversaId/lidas', mensagemController.marcarComoLidas);

// Silenciar/desilenciar conversa
router.put('/conversa/:conversaId/silenciar', mensagemController.silenciarConversa);

// Bloquear/desbloquear usuário
router.put('/conversa/:conversaId/bloquear', mensagemController.bloquearUsuario);

// Apagar conversa
router.delete('/conversa/:conversaId', mensagemController.apagarConversa);

// Buscar usuários para nova conversa
router.get('/usuarios', mensagemController.buscarUsuarios);

// Iniciar nova conversa
router.post('/conversa', mensagemController.iniciarConversa);

module.exports = router; 