const { createPost, findAllPosts, findPostById, findPostsByUserId, findLikedPostsByUserId, findRandomRecentPosts, searchPosts, createComment, findCommentById, findFullCommentById } = require('../models/post');
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

exports.getMyLikedPosts = async (req, res) => {
  try {
    const posts = await findLikedPostsByUserId(req.userId);
    res.json({
      code: 200,
      message: 'success',
      data: posts
    });
  } catch (error) {
    console.error('获取我点赞的帖子错误:', error);
    res.status(500).json({ code: 500, message: '获取我点赞的帖子失败' });
  }
};

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

// 将各种来源的 excludeIds（JSON 数组 / 逗号分隔字符串 / 单个字符串 / JSON 字符串）归一化为合法的 UUID 数组
const parseExcludeIds = (value) => {
  if (value == null) return [];

  let list = value;
  if (!Array.isArray(list)) {
    // 尝试解析 JSON 字符串（如客户端把整个数组序列化成了一个字符串）
    if (typeof list === 'string') {
      const trimmed = list.trim();
      if (trimmed.startsWith('[')) {
        try { list = JSON.parse(trimmed); } catch (e) { list = trimmed; }
      }
    }
    if (!Array.isArray(list)) {
      list = String(list).split(',').map((s) => s.trim()).filter(Boolean);
    }
  }

  return (Array.isArray(list) ? list : [])
    .filter((id) => typeof id === 'string' && UUID_RE.test(id.trim()))
    .map((id) => id.trim());
};

exports.getRandomPosts = async (req, res) => {
  try {
    // 客户端上传已获取的帖子 ID（数组），服务端将其从随机池中排除
    let excludeIds = parseExcludeIds(req.body && req.body.excludeIds);
    if (excludeIds.length === 0) {
      excludeIds = parseExcludeIds(req.query && req.query.excludeIds);
    }

    const LIMIT = 10;
    const posts = await findRandomRecentPosts(LIMIT, excludeIds);

    // 剩余帖子不足一条时，说明已无更多可获取的数据，message 提示客户端停止刷新/加载
    const message = posts.length < LIMIT ? 'NoMore' : 'success';

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

// 从客户端上传的"已加载帖子"中提取帖子 id 数组用于排除。
// 兼容完整 post 对象数组、字符串 id 数组、JSON 字符串或逗号分隔字符串，均归一化为合法 UUID 数组。
const parseExcludePostIds = (value) => {
  if (value == null) return [];

  let list = value;

  // 字符串：尝试 JSON 解析（可能整体是一个数组的序列化），否则按逗号切分
  if (typeof list === 'string') {
    const trimmed = list.trim();
    if (trimmed.startsWith('[')) {
      try { list = JSON.parse(trimmed); } catch (e) { list = trimmed; }
    } else {
      list = trimmed;
    }
  }

  // 统一转成数组
  if (!Array.isArray(list)) {
    list = String(list).split(',').map((s) => s.trim()).filter(Boolean);
  }

  const extractId = (item) => {
    if (item == null) return '';
    // 完整 post 对象：取 id 字段
    if (typeof item === 'object') {
      const id = item.id ?? item.postId;
      return typeof id === 'string' ? id.trim() : '';
    }
    // 直接是字符串 id
    return String(item).trim();
  };

  return Array.from(list)
    .map(extractId)
    .filter((id) => UUID_RE.test(id));
};

exports.searchPosts = async (req, res) => {
  try {
    const keyword = (req.body && req.body.keyword) || (req.query && req.query.keyword) || '';

    // 页大小：默认 10，最大 50（每次只返回一批，客户端累积排除后继续请求）
    let pageSize = parseInt((req.body && req.body.pageSize) ?? (req.query && req.query.pageSize), 10);
    if (Number.isNaN(pageSize) || pageSize < 1) pageSize = 10;
    if (pageSize > 50) pageSize = 50; // 防止单次拉取过大

    // 客户端上传"已选择/已加载"的帖子（完整 post 对象数组，可为 null/[]），
    // 服务端排除这些帖子后返回"未选中的"匹配帖子
    let excludePosts = req.body && (req.body.excludePosts ?? req.body.posts);
    if (!excludePosts) excludePosts = req.query && (req.query.excludePosts ?? req.query.posts);
    const excludeIds = parseExcludePostIds(excludePosts);

    const posts = await searchPosts(keyword.trim(), pageSize, excludeIds);

    // 返回数量 < pageSize 说明已没有更多未选帖子，message 置为 NoMore 提示客户端停止请求
    const message = posts.length < pageSize ? 'NoMore' : 'success';

    res.json({
      code: 200,
      message,
      data: posts
    });
  } catch (error) {
    console.error('搜索帖子错误:', error);
    res.status(500).json({ code: 500, message: '搜索失败，请稍后重试' });
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
