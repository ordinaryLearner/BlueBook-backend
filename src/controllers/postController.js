const { createPost, findAllPosts, findPostById, findPostsByUserId, findRandomRecentPosts, createComment, findCommentById, findFullCommentById } = require('../models/post');

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

exports.createComment = async (req, res) => {
  try {
    const { senderId, commentType, receiverId, postId, content, parentId } = req.body;

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

    const isReply = commentType === 'REPLYCOMMENT' || (commentType === undefined && parentId);
    const targetParentId = isReply ? (receiverId || parentId) : null;

    if (isReply && !targetParentId) {
      return res.status(400).json({ code: 400, message: '回复的评论不能为空' });
    }

    if (targetParentId) {
      const parent = await findCommentById(targetParentId);
      if (!parent || parent.post_id !== postId) {
        return res.status(400).json({ code: 400, message: '回复的评论不存在' });
      }
    }

    const comment = await createComment({
      postId,
      content: content.trim(),
      senderId: req.userId,
      parentId: targetParentId || null
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
