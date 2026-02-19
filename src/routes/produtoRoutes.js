const express = require('express');
const router = express.Router();
const produtoController = require('../controllers/produtoController');
const { authMiddleware, empresaMiddleware } = require('../middlewares/auth');
const { uploadImagem } = require('../middlewares/upload');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const commentFileFilter = (req, file, cb) => {
  const allowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'audio/aac',
    'audio/mp4'
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não permitido. Apenas imagens (JPG/PNG/WebP) e áudios são aceitos.'), false);
  }
};

const uploadProdutoCommentAnexo = multer({
  storage,
  fileFilter: commentFileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024,
  }
});

// Público
router.get('/', produtoController.list);
router.get('/:id', produtoController.getById);

// Protegido (empresa)
router.post('/', authMiddleware, empresaMiddleware, uploadImagem.array('imagens', 8), produtoController.create);
router.put('/:id', authMiddleware, empresaMiddleware, uploadImagem.array('imagens', 8), produtoController.update);
router.delete('/:id', authMiddleware, empresaMiddleware, produtoController.remove);

// Protegido (usuário logado)
router.post('/:id/reaction', authMiddleware, produtoController.toggleReaction);
router.get('/:id/comments', produtoController.listComments);
router.post('/:id/comments', authMiddleware, uploadProdutoCommentAnexo.single('anexo'), produtoController.addComment);
router.put('/:id/comments/:commentId', authMiddleware, produtoController.updateComment);
router.delete('/:id/comments/:commentId', authMiddleware, produtoController.deleteComment);

module.exports = router;
