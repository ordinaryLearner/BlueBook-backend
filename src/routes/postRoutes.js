const router = require('express').Router();
const multer = require('multer');
const postController = require('../controllers/postController');
const { authenticate } = require('../middleware/auth');

// 视频先收进内存再转发给 PutPut，不落盘；上限与 PutPut 访客计划一致
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 }
});

// 把 multer 的错误转成统一的 { code, message } 结构
const handleVideoUpload = (req, res, next) => {
  uploadVideo.single('video')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ code: 413, message: '视频文件过大' });
      }
      return res.status(400).json({ code: 400, message: '视频上传参数错误' });
    }
    console.error('视频上传中间件错误:', err);
    res.status(400).json({ code: 400, message: '视频上传失败' });
  });
};

router.post('/', authenticate, postController.createPost);
// 发布视频帖；需放在 /:id 之前
router.post('/video', authenticate, handleVideoUpload, postController.createVideoPost);
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
