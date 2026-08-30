const { createPost, findAllPosts, findPostById, findPostsByUserId, findRandomRecentPosts, createComment, findCommentById, findFullCommentById } = require('../models/post');
const { findById } = require('../models/user');

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

exports.getMyPosts = async (req, res) => {
  try {
    const posts = await findPostsByUserId(req.userId);
    res.json({
      code: 200,
      message: 'success',
      data: posts
    });
  } catch (error) {
    console.error('获取我的帖子错误:', error);
    res.status(500).json({ code: 500, message: '获取我的帖子失败' });
  }
};

exports.getRandomPosts = async (req, res) => {
  try {
    // 客户端上传已获取的帖子 ID（数组），服务端将其从随机池中排除
    let excludeIds = req.body && req.body.excludeIds;
    if (!Array.isArray(excludeIds)) {
      const raw = req.query && req.query.excludeIds;
      if (raw) {
        excludeIds = Array.isArray(raw) ? raw : String(raw).split(',').map((s) => s.trim());
      }
    }
    excludeIds = (Array.isArray(excludeIds) ? excludeIds : [])
      .filter((id) => typeof id === 'string' && id.trim() && /^[0-9a-fA-F-]{36}$/.test(id.trim()))
      .map((id) => id.trim());

    const LIMIT = 10;
    const posts = await findRandomRecentPosts(LIMIT, excludeIds);

    // 剩余帖子不足一条时，说明已无更多可获取的数据，message 提示客户端停止刷新/加载
    const message = posts.length < LIMIT ? '已无相关数据' : 'success';

    res.json({
      code: 200,
      message,
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

exports.createComment = async (req, res) => {
  try {
    const { commentType, receiverId, commentId, postId, content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ code: 400, message: '评论内容不能为空' });
    }

    if (!postId) {
      return res.status(400).json({ code: 400, message: '帖子ID不能为空' });
    }

    const post = await findPostById(postId);
    if (!post) {
      return res.status(404).json({ code: 404, message: '帖子不存在' });
    }

    let parentId = null;
    let receiver = null;

    if (commentType === 'REPLYCOMMENT') {
      // 回复评论：commentId 为被回复的评论 ID（作为父评论），receiverId 为被回复者（用户）ID
      if (!commentId) {
        return res.status(400).json({ code: 400, message: '回复的评论ID(commentId)不能为空' });
      }
      if (!receiverId) {
        return res.status(400).json({ code: 400, message: '被回复者ID(receiverId)不能为空' });
      }

      const parent = await findCommentById(commentId);
      if (!parent || parent.post_id !== postId) {
        return res.status(400).json({ code: 400, message: '回复的评论不存在' });
      }

      receiver = await findById(receiverId);
      if (!receiver) {
        return res.status(400).json({ code: 400, message: '被回复的用户不存在' });
      }

      parentId = commentId;
    }

    const comment = await createComment({
      postId,
      content: content.trim(),
      senderId: req.userId,
      parentId,
      receiverId: receiver ? receiver.id : null
    });

    const fullComment = await findFullCommentById(comment.id);

    res.status(201).json({
      code: 200,
      message: '评论成功',
      data: fullComment
    });
  } catch (error) {
    console.error('发布评论错误:', error);
    res.status(500).json({ code: 500, message: '评论失败，请稍后重试' });
  }
};
