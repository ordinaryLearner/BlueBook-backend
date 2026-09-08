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

// 把每条评论的 likes(用户 ID 列表)批量展开为用户信息对象列表
const attachLikesToComments = async (rows) => {
  if (rows.length === 0) return rows;

  const allIds = [];
  for (const row of rows) {
    if (Array.isArray(row.likes)) {
      for (const id of row.likes) if (id && !allIds.includes(id)) allIds.push(id);
    }
  }

  const byId = {};
  if (allIds.length > 0) {
    const result = await pool.query(`
      SELECT id, account, username, avatar, bio, join_time
      FROM users
      WHERE id = ANY($1::uuid[])
    `, [allIds]);
    for (const u of result.rows) {
      if (u.join_time) u.join_time = formatTime(u.join_time);
      byId[u.id] = u;
    }
  }

  for (const row of rows) {
    row.likes = (Array.isArray(row.likes) ? row.likes : [])
      .map((id) => byId[id] || null)
      .filter(Boolean);
  }

  return rows;
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

  const expanded = await attachLikesToComments(result.rows);
  return buildCommentTree(expanded);
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

// 按客户端上传的帖子 ID 列表批量返回帖子（用于浏览历史/已浏览过的帖子回显），
// 保持传入顺序，帖子已被删除的对应位置跳过
const findPostsByIds = async (postIds) => {
  const ids = Array.isArray(postIds) ? postIds.filter(Boolean) : [];
  if (ids.length === 0) return [];

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
    WHERE p.id = ANY($1::uuid[])
  `, [ids]);

  const byId = new Map(result.rows.map((post) => [post.id, post]));
  const ordered = ids
    .map((id) => byId.get(id))
    .filter(Boolean);

  return attachCommentsToPosts(ordered);
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

// 查询某用户收藏过的所有帖子：收藏关系统一由 posts.favourite(JSONB 用户ID数组)承载，
// 反向找出所有 favourite 中包含该用户 ID 的帖子，按创建时间倒序返回
const findFavoritePostsByUserId = async (userId) => {
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
    WHERE p.favourite @> $1::jsonb
    ORDER BY p.created_at DESC
  `, [JSON.stringify([userId])]);

  return attachCommentsToPosts(result.rows);
};

// 收藏帖子：把 userId 幂等加入该帖子的 favourite(JSONB 用户ID列表)，收藏关系只存于帖子侧
const addFavorite = async (userId, postId) => {
  const result = await pool.query(`
    UPDATE posts
    SET favourite = CASE WHEN favourite @> $2::jsonb THEN favourite ELSE favourite || $2::jsonb END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `, [postId, JSON.stringify([userId])]);
  return result.rows[0] || null;
};

// 取消收藏：把 userId 从该帖子的 favourite 中幂等移除
const removeFavorite = async (userId, postId) => {
  const result = await pool.query(`
    UPDATE posts
    SET favourite = (SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
                     FROM jsonb_array_elements(favourite) elem
                     WHERE elem::text <> $2),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `, [postId, JSON.stringify(userId)]);
  return result.rows[0] || null;
};

// 判断某用户是否已收藏某帖子（查帖子的 favourite 是否包含该用户 ID）
const isFavorited = async (userId, postId) => {
  const result = await pool.query(
    'SELECT favourite FROM posts WHERE id = $1',
    [postId]
  );
  const row = result.rows[0];
  if (!row) return false;
  const favourite = Array.isArray(row.favourite) ? row.favourite : [];
  return favourite.some((id) => id === userId);
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

  const row = (await attachLikesToComments([result.rows[0]]))[0];
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
  findPostsByIds,
  findPostsByUserId,
  findLikedPostsByUserId,
  findFavoritePostsByUserId,
  addFavorite,
  removeFavorite,
  isFavorited,
  findRandomRecentPosts,
  searchPosts,
  createComment,
  findCommentById,
  findFullCommentById,
  addLike,
  removeLike
};