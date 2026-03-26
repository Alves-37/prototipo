const express = require('express');
const router = express.Router();
const publicUserController = require('../controllers/publicUserController');

router.get('/users', publicUserController.listPublicUsers);
router.get('/users/:id', publicUserController.getPublicUserById);

module.exports = router;
