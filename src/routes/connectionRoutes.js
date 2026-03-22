const express = require('express');
const router = express.Router();
const connectionController = require('../controllers/connectionController');
const { authMiddleware } = require('../middlewares/auth');

router.use(authMiddleware);

router.get('/status/:targetId', connectionController.getStatus);
router.get('/requests', connectionController.listIncoming);
// Rotas específicas antes de `/:targetId`, para nunca interpretar "accept"/"reject" como ID de utilizador
router.post('/:id/accept', connectionController.accept);
router.post('/:id/reject', connectionController.reject);
router.post('/:targetId', connectionController.request);
router.delete('/:targetId', connectionController.remove);

module.exports = router;
