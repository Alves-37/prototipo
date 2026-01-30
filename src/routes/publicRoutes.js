const express = require('express');
const router = express.Router();
const feedController = require('../controllers/feedController');

router.get('/users', feedController.listPublicUsers);

module.exports = router;
