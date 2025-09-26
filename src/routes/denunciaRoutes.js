const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');
const denunciaController = require('../controllers/denunciaController');

// Criar denúncia - somente autenticado (não permitir anônimas)
router.post('/', authMiddleware, upload.single('anexo'), denunciaController.criar);

// Rotas de administração (se houver adminMiddleware, aplicar aqui)
// Ex.: const { adminMiddleware } = require('../middlewares/auth');
// router.get('/', authMiddleware, adminMiddleware, denunciaController.listar);
// router.get('/:id', authMiddleware, adminMiddleware, denunciaController.detalhe);
// router.put('/:id/status', authMiddleware, adminMiddleware, denunciaController.atualizarStatus);

module.exports = router;
