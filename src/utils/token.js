// src/utils/token.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'bluebook-super-secret-key-2024';

// 生成 Token（有效期 7 天）
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

module.exports = { generateToken, JWT_SECRET };
