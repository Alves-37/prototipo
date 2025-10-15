const express = require('express');
const requireAdmin = require('../middleware/requireAdmin');
const adminStatsController = require('../controllers/adminStatsController');
const adminUsersController = require('../controllers/adminUsersController');
const adminDenunciasController = require('../controllers/adminDenunciasController');
const adminApoioController = require('../controllers/adminApoioController');
const adminMaintenanceController = require('../controllers/adminMaintenanceController');
const versionController = require('../controllers/versionController');
const userController = require('../controllers/userController');

const router = express.Router();

// Todas as rotas abaixo exigem admin
router.use(requireAdmin);

// Stats
router.get('/stats/overview', adminStatsController.overview);
router.get('/system/info', versionController.get);

// Usuários
router.get('/usuarios', adminUsersController.list);
router.put('/usuarios/:id/ativar', adminUsersController.ativar);
router.put('/usuarios/:id/desativar', adminUsersController.desativar);
router.delete('/usuarios/:id', adminUsersController.excluir);

// Denúncias
router.get('/denuncias', adminDenunciasController.list);

// Apoio (mensagens/chamados abertos)
router.get('/apoio', adminApoioController.list);

// Manutenção (somente dev)
router.post('/maintenance/reset', adminMaintenanceController.resetDatabase);
// Purga de contas suspensas expiradas (admin)
router.post('/maintenance/purge-users', userController.purgarContasExpiradas);

module.exports = router;
