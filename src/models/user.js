// src/models/user.js
const { pool } = require('../config/database');
const { formatTime } = require('../utils/time');

// 对外暴露的用户非敏感字段（密码一律不返回）
const PUBLIC_COLUMNS = `
  id, account, username, avatar, background, bio,
  followers, fans, join_time
`;

const formatUser = (row) => {
  if (!row) return null;
  if (row.join_time) row.join_time = formatTime(row.join_time);
  if (row.created_at) row.created_at = formatTime(row.created_at);
  if (row.updated_at) row.updated_at = formatTime(row.updated_at);
  return row;
};

// 计算该用户所有帖子收到的点赞总数（每帖 likes 数组长度之和）
const computeTotalLikes = async (userId) => {
  const result = await pool.query(`
    SELECT COALESCE(SUM(jsonb_array_length(COALESCE(likes, '[]'::jsonb))), 0)::int AS total
    FROM posts
    WHERE sender_id = $1
  `, [userId]);
  return Number(result.rows[0]?.total) || 0;
};

// 统一的用户资料富化：把关注/粉丝改为主粒度数量（Int），并附上收到的点赞总数
const enrichProfile = async (row) => {
  const user = formatUser(row);
  if (!user) return null;
  // followers/fans 列存的是 JSONB(用户ID数组)，对外只暴露数量
  user.followers = Array.isArray(user.followers) ? user.followers.length : 0;
  user.fans = Array.isArray(user.fans) ? user.fans.length : 0;
  user.totalLikes = await computeTotalLikes(user.id);
  return user;
};

// 根据账号查找用户
const findByAccount = async (account) => {
  const result = await pool.query(
    'SELECT * FROM users WHERE account = $1',
    [account]
  );
  const user = formatUser(result.rows[0] || null);
  // 富化用户资料，保证各接口返回一致（关注/粉丝列表 + 点赞总数）
  return enrichProfile(user);
};

// 根据ID查找用户
const findById = async (id) => {
  const result = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`,
    [id]
  );
  const user = formatUser(result.rows[0] || null);
  return enrichProfile(user);
};

// 创建用户
const createUser = async (account, password, username) => {
  const result = await pool.query(
    `INSERT INTO users (account, password, username, join_time) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     RETURNING ${PUBLIC_COLUMNS}`,
    [account, password, username || account]
  );
  return enrichProfile(formatUser(result.rows[0]));
};

// 更新用户资料（用户名、头像、背景图、签名），未提供的字段保持原值
const updateProfile = async (id, { username, avatar, background, bio }) => {
  const result = await pool.query(
    `UPDATE users
     SET username = COALESCE($1, username),
         avatar = COALESCE($2, avatar),
         background = COALESCE($3, background),
         bio = COALESCE($4, bio),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $5
     RETURNING ${PUBLIC_COLUMNS}`,
    [username ?? null, avatar ?? null, background ?? null, bio ?? null, id]
  );
  const user = formatUser(result.rows[0] || null);
  return enrichProfile(user);
};

// 关注用户：把 targetId 加入自己的 followers（关注列表），并把 followById 加入目标用户的 fans
const followUser = async (followById, targetId) => {
  await pool.query(`
    UPDATE users
    SET followers = CASE WHEN followers @> $1::jsonb THEN followers ELSE followers || $1::jsonb END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
  `, [JSON.stringify([targetId]), followById]);
  await pool.query(`
    UPDATE users
    SET fans = CASE WHEN fans @> $1::jsonb THEN fans ELSE fans || $1::jsonb END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
  `, [JSON.stringify([followById]), targetId]);
};

// 取关用户：从自己 followers（关注列表）与目标用户 fans 中移除对应 ID
const unfollowUser = async (followById, targetId) => {
  await pool.query(`
    UPDATE users
    SET followers = (SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
                     FROM jsonb_array_elements(followers) elem
                     WHERE elem::text <> $1),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
  `, [JSON.stringify(targetId), followById]);
  await pool.query(`
    UPDATE users
    SET fans = (SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
                FROM jsonb_array_elements(fans) elem
                WHERE elem::text <> $1),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
  `, [JSON.stringify(followById), targetId]);
};

// 判断是否已关注目标用户
const isFollowing = async (userId, targetId) => {
  const result = await pool.query(
    `SELECT followers FROM users WHERE id = $1`,
    [userId]
  );
  const followers = result.rows[0]?.followers || [];
  return Array.isArray(followers)
    ? followers.some((id) => id === targetId)
    : false;
};

// 轻量存在性校验（用于鉴权中间件，避免解析关注列表带来的开销）
const userExists = async (id) => {
  const result = await pool.query('SELECT 1 FROM users WHERE id = $1', [id]);
  return result.rows.length > 0;
};

// 将一组用户 ID 还原为精简的 User 对象（不递归展开关注/粉丝，避免循环与开销），顺序与 ids 一致
const idsToUsers = async (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const result = await pool.query(`
    SELECT id, account, username, avatar, bio, join_time
    FROM users
    WHERE id = ANY($1::uuid[])
  `, [ids]);
  const byId = new Map(result.rows.map((u) => [u.id, u]));
  return ids.map((id) => {
    const u = byId.get(id);
    if (!u) return null;
    if (u.join_time) u.join_time = formatTime(u.join_time);
    return u;
  }).filter(Boolean);
};

// 分页取出某用户的关键列表（kind: 'followers' 关注列表 / 'fans' 粉丝列表），每次最多 pageSize（上限 30）
const listFollows = async (userId, kind, page = 1, pageSize = 30) => {
  if (!['followers', 'fans'].includes(kind)) {
    throw new Error('kind 必须是 followers 或 fans');
  }
  page = Math.max(1, Math.floor(page) || 1);
  const limit = Math.min(Math.max(1, Math.floor(pageSize) || 30), 30);

  const result = await pool.query(
    `SELECT followers, fans FROM users WHERE id = $1`,
    [userId]
  );
  const row = result.rows[0];
  if (!row) return null; // 用户不存在

  const all = Array.isArray(row[kind]) ? row[kind] : [];
  const total = all.length;
  const offset = (page - 1) * limit;
  const slice = all.slice(offset, offset + limit);
  const users = await idsToUsers(slice);

  return {
    total,
    page,
    pageSize: limit,
    hasMore: offset + slice.length < total,
    users
  };
};

module.exports = {
  findByAccount,
  findById,
  createUser,
  updateProfile,
  followUser,
  unfollowUser,
  isFollowing,
  userExists,
  listFollows
};
