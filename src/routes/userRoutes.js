const router = require('express').Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

router.get('/:id', userController.getUserById);
router.put('/profile', authenticate, userController.updateProfile);

module.exports = router;
