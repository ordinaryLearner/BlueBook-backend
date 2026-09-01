// src/models/user.js
const { pool } = require('../config/database');
const { formatTime } = require('../utils/time');

const formatUser = (row) => {
  if (!row) return null;
  if (row.join_time) row.join_time = formatTime(row.join_time);
  if (row.created_at) row.created_at = formatTime(row.created_at);
  if (row.updated_at) row.updated_at = formatTime(row.updated_at);
  return row;
};

// 根据账号查找用户
const findByAccount = async (account) => {
  const result = await pool.query(
    'SELECT * FROM users WHERE account = $1',
    [account]
  );
  return formatUser(result.rows[0] || null);
};

// 根据ID查找用户
const findById = async (id) => {
  const result = await pool.query(
    'SELECT id, account, username, avatar, background, bio, join_time FROM users WHERE id = $1',
    [id]
  );
  return formatUser(result.rows[0] || null);
};

// 创建用户
const createUser = async (account, password, username) => {
  const result = await pool.query(
    'INSERT INTO users (account, password, username, join_time) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING id, account, username, avatar, background, bio, join_time',
    [account, password, username || account]
  );
  return formatUser(result.rows[0]);
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
     RETURNING id, account, username, avatar, background, bio, join_time`,
    [username ?? null, avatar ?? null, background ?? null, bio ?? null, id]
  );
  return formatUser(result.rows[0] || null);
};

module.exports = { findByAccount, findById, createUser, updateProfile };