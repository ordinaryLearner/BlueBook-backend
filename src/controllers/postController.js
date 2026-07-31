const { createPost, findAllPosts, findPostById, findRandomRecentPosts } = require('../models/post');

exports.createPost = async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!req.userId) {
      return res.status(401).json({ code: 401, message: '请先登录' });
    }

    const imageUrls = [];

    const collect = (field) => {
      let urls = req.body[field];
      if (!urls) return;
      if (typeof urls === 'string') {
        try { urls = JSON.parse(urls); } catch (e) { urls = [urls]; }
      }
      if (Array.isArray(urls)) {
        urls.forEach((u) => {
          if (typeof u === 'string' && u.trim()) imageUrls.push(u.trim());
        });
      }
    };

    collect('images');
    collect('imageUrls');

    const post = await createPost(
      title || '',
      content,
      req.userId,
      imageUrls
    );

    const fullPost = await findPostById(post.id);

    res.status(201).json({
      code: 200,
      message: '发布成功',
      data: fullPost
    });
  } catch (error) {
    console.error('发布帖子错误:', error);
    res.status(500).json({ code: 500, message: '发布失败，请稍后重试' });
  }
};

exports.getPosts = async (req, res) => {
  try {
    const posts = await findAllPosts();
    res.json({
      code: 200,
      message: 'success',
      data: posts
    });
  } catch (error) {
    console.error('获取帖子列表错误:', error);
    res.status(500).json({ code: 500, message: '获取帖子列表失败' });
  }
};

exports.getRandomPosts = async (req, res) => {
  try {
    const posts = await findRandomRecentPosts(10);
    res.json({
      code: 200,
      message: 'success',
      data: posts
    });
  } catch (error) {
    console.error('获取随机帖子错误:', error);
    res.status(500).json({ code: 500, message: '获取随机帖子失败' });
  }
};

exports.getPostById = async (req, res) => {
  try {
    const post = await findPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ code: 404, message: '帖子不存在' });
    }
    res.json({
      code: 200,
      message: 'success',
      data: post
    });
  } catch (error) {
    console.error('获取帖子详情错误:', error);
    res.status(500).json({ code: 500, message: '获取帖子详情失败' });
  }
};
