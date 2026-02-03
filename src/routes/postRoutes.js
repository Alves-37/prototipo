const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { authMiddleware } = require('../middlewares/auth');

// Público
router.get('/', postController.list);
router.get('/:id/comments', postController.listComments);

// Protegido
router.post('/', authMiddleware, postController.create);
router.put('/:id', authMiddleware, postController.update);
router.delete('/:id', authMiddleware, postController.remove);
router.post('/:id/like', authMiddleware, postController.toggleLike);
router.post('/:id/comments', authMiddleware, postController.addComment);

module.exports = router;
