const express = require('express');
const router = express.Router();
const empresaController = require('../controllers/empresaController');

// Rotas para estatísticas, alertas e atividades da empresa
router.get('/:id/stats', empresaController.getStats);
router.get('/:id/alertas', empresaController.getAlertas);
router.get('/:id/atividades', empresaController.getAtividades);

module.exports = router; 