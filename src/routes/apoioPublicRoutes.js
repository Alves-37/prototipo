const express = require('express');
const router = express.Router();
const apoioPublicController = require('../controllers/apoioPublicController');

// Public endpoint to receive support messages
router.post('/', apoioPublicController.create);

module.exports = router;
