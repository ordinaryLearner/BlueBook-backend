const router = require('express').Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');

router.get('/:id', userController.getUserById);
router.put('/profile', authenticate, userController.updateProfile);

// 关注关系
router.post('/:id/follow', authenticate, userController.follow);
router.delete('/:id/unfollow', authenticate, userController.unfollow);
router.get('/:id/follow/status', authenticate, userController.followStatus);

module.exports = router;
