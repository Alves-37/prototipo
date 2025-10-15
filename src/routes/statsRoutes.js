const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');

// Rota pública para obter estatísticas
router.get('/', statsController.getStats);

module.exports = router;
