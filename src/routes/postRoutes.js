const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { authMiddleware } = require('../middlewares/auth');

// Público
router.get('/', postController.list);
router.get('/:id/comments', postController.listComments);

// Protegido
router.post('/', authMiddleware, postController.create);
router.post('/:id/like', authMiddleware, postController.toggleLike);
router.post('/:id/comments', authMiddleware, postController.addComment);

module.exports = router;
