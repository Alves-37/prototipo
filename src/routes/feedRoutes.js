const express = require('express');
const router = express.Router();
const feedController = require('../controllers/feedController');

router.get('/', feedController.getFeed);

module.exports = router;
