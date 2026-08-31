const router = require('express').Router();
const postController = require('../controllers/postController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, postController.createPost);
router.get('/', postController.getPosts);
router.get('/my', authenticate, postController.getMyPosts);
router.get('/myliked', authenticate, postController.getMyLikedPosts);
router.get('/random', postController.getRandomPosts);
router.post('/random', postController.getRandomPosts);
router.get('/:id', postController.getPostById);

module.exports = router;
