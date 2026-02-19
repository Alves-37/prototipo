const express = require('express');
const router = express.Router();
const vagaController = require('../controllers/vagaController');
const { authMiddleware, empresaMiddleware } = require('../middlewares/auth');
const { uploadImagem } = require('../middlewares/upload');

// Rotas públicas (não precisam de autenticação)
router.get('/', vagaController.listarTodas);
router.get('/:id', vagaController.listarPorId);

// Rotas protegidas (precisam de autenticação)
router.use(authMiddleware); // Todas as rotas abaixo precisam de autenticação

// Rotas específicas para empresas
router.get('/empresa/minhas-vagas', empresaMiddleware, vagaController.listarPorEmpresa);
router.get('/empresa/:empresaId', vagaController.buscarPorEmpresa);

router.post('/', empresaMiddleware, uploadImagem.single('imagem'), vagaController.criar);
router.put('/:id', empresaMiddleware, uploadImagem.single('imagem'), vagaController.atualizar);
router.delete('/:id', empresaMiddleware, vagaController.deletar);

module.exports = router; 