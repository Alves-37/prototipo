const express = require('express');
const router = express.Router();
const feedController = require('../controllers/feedController');

router.get('/users', feedController.listPublicUsers);
router.get('/users/:id', feedController.getPublicUserById);

module.exports = router;
