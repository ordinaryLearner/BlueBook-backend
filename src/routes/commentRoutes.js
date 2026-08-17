const router = require('express').Router();
const postController = require('../controllers/postController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, postController.createComment);

module.exports = router;