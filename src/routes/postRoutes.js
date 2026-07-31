const router = require('express').Router();
const multer = require('multer');
const postController = require('../controllers/postController');
const { authenticate } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 32 * 1024 * 1024 } });

router.post('/', authenticate, upload.array('images', 9), postController.createPost);
router.get('/', postController.getPosts);
router.get('/random', postController.getRandomPosts);
router.get('/:id', postController.getPostById);

module.exports = router;
