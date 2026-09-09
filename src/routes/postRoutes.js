const router = require('express').Router();
const postController = require('../controllers/postController');
const { authenticate } = require('../middleware/auth');

router.post('/', authenticate, postController.createPost);
router.get('/', postController.getPosts);
router.get('/my', authenticate, postController.getMyPosts);
router.get('/myliked', authenticate, postController.getMyLikedPosts);
router.get('/myfavorites', authenticate, postController.getMyFavorites);
// 获取指定用户(userId)发布的帖子列表
router.get('/user/:userId', postController.getUserPosts);
// 上传浏览历史帖子 ID 列表，返回对应帖子（保持传入顺序）
router.post('/history', authenticate, postController.getHistoryPosts);
// 收藏/取消收藏指定帖子
router.post('/:id/favorite', authenticate, postController.favorite);
router.delete('/:id/favorite', authenticate, postController.unfavorite);
router.get('/random', postController.getRandomPosts);
router.post('/random', postController.getRandomPosts);
router.get('/search', postController.searchPosts);
router.post('/search', postController.searchPosts);
router.get('/:id', postController.getPostById);

module.exports = router;
