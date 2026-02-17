const express = require('express');
const router = express.Router();
const produtoController = require('../controllers/produtoController');
const { authMiddleware, empresaMiddleware } = require('../middlewares/auth');
const { uploadImagem } = require('../middlewares/upload');

// Público
router.get('/', produtoController.list);
router.get('/:id', produtoController.getById);

// Protegido (empresa)
router.post('/', authMiddleware, empresaMiddleware, uploadImagem.array('imagens', 8), produtoController.create);
router.put('/:id', authMiddleware, empresaMiddleware, uploadImagem.array('imagens', 8), produtoController.update);
router.delete('/:id', authMiddleware, empresaMiddleware, produtoController.remove);

module.exports = router;
