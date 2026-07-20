// src/models/user.js
const { pool } = require('../config/database');

// 根据账号查找用户
const findByAccount = async (account) => {
  const result = await pool.query(
    'SELECT * FROM users WHERE account = $1',
    [account]
  );
  return result.rows[0] || null;
};

// 根据ID查找用户
const findById = async (id) => {
  const result = await pool.query(
    'SELECT id, account, username, avatar, bio, join_time FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
};

// 创建用户
const createUser = async (account, password, username) => {
  const result = await pool.query(
    'INSERT INTO users (account, password, username, join_time) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) RETURNING id, account, username, avatar, bio, join_time',
    [account, password, username || account]
  );
  return result.rows[0];
};

module.exports = { findByAccount, findById, createUser };