const router = require('express').Router();
const postController = require('../controllers/postController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, postController.createPost);
router.get('/', postController.getPosts);
router.get('/random', postController.getRandomPosts);
router.get('/:id', postController.getPostById);

module.exports = router;
