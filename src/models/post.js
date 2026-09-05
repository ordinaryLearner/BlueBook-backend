const { pool } = require('../config/database');
const { formatTime } = require('../utils/time');

const formatPost = (post) => {
  if (!post) return null;
  if (post.created_at) {
    post.time = post.time || formatTime(post.created_at);
    post.created_at = formatTime(post.created_at);
  }
  if (post.updated_at) post.updated_at = formatTime(post.updated_at);
  if (post.sender && post.sender.join_time) post.sender.join_time = formatTime(post.sender.join_time);
  return post;
};

const createPost = async (title, content, senderId, imageUrls) => {
  const postResult = await pool.query(
    'INSERT INTO posts (title, content, sender_id) VALUES ($1, $2, $3) RETURNING *',
    [title, content, senderId]
  );
  const post = postResult.rows[0];

  for (let i = 0; i < imageUrls.length; i++) {
    await pool.query(
      'INSERT INTO post_medias (post_id, type, url, sort_order) VALUES ($1, $2, $3, $4)',
      [post.id, 'IMAGE', imageUrls[i], i]
    );
  }

  return post;
};

const findMediasByPostId = async (postId) => {
  const result = await pool.query(
    'SELECT id, type, url FROM post_medias WHERE post_id = $1 ORDER BY sort_order',
    [postId]
  );
  return result.rows;
};

const buildCommentTree = (rows) => {
  const nodes = new Map();
  const roots = [];

  for (const row of rows) {
    const node = {
      id: row.id,
      content: row.content,
      time: formatTime(row.created_at),
      type: row.parent_id ? 'REPLYCOMMENT' : 'POSTCOMMENT',
      sender: row.sender,
      receiver: row.receiver || null,
      likes: row.likes,
      comments: []
    };
    node._parentId = row.parent_id;
    nodes.set(row.id, node);
  }

  for (const node of nodes.values()) {
    if (node._parentId && nodes.has(node._parentId)) {
      nodes.get(node._parentId).comments.push(node);
    } else {
      roots.push(node);
    }
  }

  const clean = (node) => {
    delete node._parentId;
    node.comments = node.comments.map(clean);
    return node;
  };

  return roots.map(clean);
};

const findCommentsByPostId = async (postId) => {
  const result = await pool.query(`
    SELECT c.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'account', u.account,
        'avatar', u.avatar
      ) as sender,
      CASE WHEN ru.id IS NULL THEN NULL ELSE json_build_object(
        'id', ru.id,
        'username', ru.username,
        'account', ru.account,
        'avatar', ru.avatar
      ) END as receiver
    FROM comments c
    JOIN users u ON c.sender_id = u.id
    LEFT JOIN users ru ON c.receiver_id = ru.id
    WHERE c.post_id = $1
    ORDER BY c.created_at ASC
  `, [postId]);

  return buildCommentTree(result.rows);
};

const attachCommentsToPosts = async (posts) => {
  for (const post of posts) {
    post.medias = await findMediasByPostId(post.id);
    post.comments = await findCommentsByPostId(post.id);
    formatPost(post);
  }
  return posts;
};

const findAllPosts = async () => {
  const result = await pool.query(`
    SELECT p.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'account', u.account,
        'avatar', u.avatar,
        'bio', u.bio,
        'join_time', u.join_time
      ) as sender
    FROM posts p
    JOIN users u ON p.sender_id = u.id
    ORDER BY p.created_at DESC
  `);

  return attachCommentsToPosts(result.rows);
};

const findPostById = async (id) => {
  const result = await pool.query(`
    SELECT p.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'account', u.account,
        'avatar', u.avatar,
        'bio', u.bio,
        'join_time', u.join_time
      ) as sender
    FROM posts p
    JOIN users u ON p.sender_id = u.id
    WHERE p.id = $1
  `, [id]);

  if (result.rows.length === 0) return null;

  const post = result.rows[0];
  post.medias = await findMediasByPostId(post.id);
  post.comments = await findCommentsByPostId(post.id);

  return formatPost(post);
};

const findPostsByUserId = async (userId) => {
  const result = await pool.query(`
    SELECT p.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'account', u.account,
        'avatar', u.avatar,
        'bio', u.bio,
        'join_time', u.join_time
      ) as sender
    FROM posts p
    JOIN users u ON p.sender_id = u.id
    WHERE p.sender_id = $1
    ORDER BY p.created_at DESC
  `, [userId]);

  return attachCommentsToPosts(result.rows);
};

// 查询某用户点赞过的所有帖子（likes JSONB 数组中包含该用户 ID）
const findLikedPostsByUserId = async (userId) => {
  const result = await pool.query(`
    SELECT p.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'account', u.account,
        'avatar', u.avatar,
        'bio', u.bio,
        'join_time', u.join_time
      ) as sender
    FROM posts p
    JOIN users u ON p.sender_id = u.id
    WHERE p.likes @> $1::jsonb
    ORDER BY p.created_at DESC
  `, [JSON.stringify([userId])]);

  return attachCommentsToPosts(result.rows);
};

// 模糊搜索标题和内容，排除客户端已上传的(已加载)帖子后，按创建时间倒序取一页匹配的帖子
const searchPosts = async (keyword, limit = 10, excludeIds = []) => {
  const ids = Array.isArray(excludeIds) ? excludeIds.filter(Boolean) : [];
  const pattern = `%${keyword || ''}%`;

  const result = await pool.query(`
    SELECT p.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'account', u.account,
        'avatar', u.avatar,
        'bio', u.bio,
        'join_time', u.join_time
      ) as sender
    FROM posts p
    JOIN users u ON p.sender_id = u.id
    WHERE (p.title ILIKE $1 OR p.content ILIKE $1)
      AND (($2::uuid[] IS NULL) OR NOT (p.id = ANY($2::uuid[])))
    ORDER BY p.created_at DESC
    LIMIT $3
  `, [pattern, ids.length > 0 ? ids : null, limit]);

  return attachCommentsToPosts(result.rows);
};

const findRandomRecentPosts = async (limit = 10, excludeIds = []) => {
  const ids = Array.isArray(excludeIds) ? excludeIds.filter(Boolean) : [];
  const result = await pool.query(`
    SELECT p.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'account', u.account,
        'avatar', u.avatar,
        'bio', u.bio,
        'join_time', u.join_time
      ) as sender
    FROM (
      SELECT * FROM posts ORDER BY created_at DESC LIMIT 100
    ) p
    JOIN users u ON p.sender_id = u.id
    WHERE ($1::uuid[] IS NULL) OR NOT (p.id = ANY($1::uuid[]))
    ORDER BY RANDOM()
    LIMIT $2
  `, [ids.length > 0 ? ids : null, limit]);

  return attachCommentsToPosts(result.rows);
};

const createComment = async ({ postId, content, senderId, parentId = null, receiverId = null }) => {
  const result = await pool.query(
    `INSERT INTO comments (post_id, content, sender_id, parent_id, receiver_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [postId, content, senderId, parentId, receiverId]
  );
  return result.rows[0];
};

const findCommentById = async (id) => {
  const result = await pool.query('SELECT * FROM comments WHERE id = $1', [id]);
  return result.rows[0] || null;
};

// 点赞：将用户 ID 加入 posts 或 comments 的 likes(JSONB 用户 ID 列表)，已存在则保持不变，返回更新后的目标行
const addLike = async (targetType, targetId, userId) => {
  const table = targetType === 'post' ? 'posts' : 'comments';
  const setExpr = targetType === 'post'
    ? 'SET likes = CASE WHEN likes @> $2::jsonb THEN likes ELSE likes || $2::jsonb END, updated_at = CURRENT_TIMESTAMP'
    : 'SET likes = CASE WHEN likes @> $2::jsonb THEN likes ELSE likes || $2::jsonb END';
  const result = await pool.query(
    `UPDATE ${table} ${setExpr} WHERE id = $1 RETURNING *`,
    [targetId, JSON.stringify([userId])]
  );
  return result.rows[0] || null;
};

// 取消点赞：将用户 ID 从 posts 或 comments 的 likes(JSONB 用户 ID 列表)中移除，返回更新后的目标行
const removeLike = async (targetType, targetId, userId) => {
  const table = targetType === 'post' ? 'posts' : 'comments';
  const setExpr = targetType === 'post'
    ? "SET likes = (SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) FROM jsonb_array_elements(likes) elem WHERE elem::text <> $2), updated_at = CURRENT_TIMESTAMP"
    : "SET likes = (SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) FROM jsonb_array_elements(likes) elem WHERE elem::text <> $2)";
  const result = await pool.query(
    `UPDATE ${table} ${setExpr} WHERE id = $1 RETURNING *`,
    [targetId, JSON.stringify(userId)]
  );
  return result.rows[0] || null;
};

const findFullCommentById = async (id) => {
  const result = await pool.query(`
    SELECT c.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'account', u.account,
        'avatar', u.avatar
      ) as sender,
      CASE WHEN ru.id IS NULL THEN NULL ELSE json_build_object(
        'id', ru.id,
        'username', ru.username,
        'account', ru.account,
        'avatar', ru.avatar
      ) END as receiver
    FROM comments c
    JOIN users u ON c.sender_id = u.id
    LEFT JOIN users ru ON c.receiver_id = ru.id
    WHERE c.id = $1
  `, [id]);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    content: row.content,
    time: formatTime(row.created_at),
    type: row.parent_id ? 'REPLYCOMMENT' : 'POSTCOMMENT',
    sender: row.sender,
    receiver: row.receiver || null,
    likes: row.likes,
    comments: []
  };
};

module.exports = {
  createPost,
  findAllPosts,
  findPostById,
  findPostsByUserId,
  findLikedPostsByUserId,
  findRandomRecentPosts,
  searchPosts,
  createComment,
  findCommentById,
  findFullCommentById,
  addLike,
  removeLike
};