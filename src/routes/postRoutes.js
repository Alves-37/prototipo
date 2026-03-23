const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { authMiddleware } = require('../middlewares/auth');
const { upload } = require('../middlewares/upload');

// Público
router.get('/', postController.list);
router.get('/:id/comments', postController.listComments);
router.get('/:id/likes', postController.listLikes);
router.post('/:id/view', postController.registerView);

// Protegido
router.post('/', authMiddleware, upload.single('media'), postController.create);
router.put('/:id', authMiddleware, upload.single('media'), postController.update);
router.delete('/:id', authMiddleware, postController.remove);
router.post('/:id/like', authMiddleware, postController.toggleLike);
router.post('/:id/interest', authMiddleware, postController.setInterest);
router.post('/:id/comments', authMiddleware, postController.addComment);
router.put('/:id/comments/:commentId', authMiddleware, postController.updateComment);
router.delete('/:id/comments/:commentId', authMiddleware, postController.removeComment);
router.get('/company/metrics', authMiddleware, postController.getCompanyPostMetrics);

module.exports = router;
