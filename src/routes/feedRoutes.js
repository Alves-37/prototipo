const express = require('express');
const router = express.Router();
const feedController = require('../controllers/feedController');
const { optionalAuthMiddleware } = require('../middlewares/auth');

router.get('/', optionalAuthMiddleware, feedController.listar);

module.exports = router;
