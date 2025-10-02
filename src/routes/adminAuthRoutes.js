const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/adminAuthController');

// POST /api/admin/auth/login
router.post('/login', adminAuthController.login);

module.exports = router;
