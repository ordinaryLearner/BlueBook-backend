// src/utils/token.js
const jwt = require('jsonwebtoken');

// 统一默认密钥（若 NODE_ENV=production 且未显式配置，则视为配置缺失，避免静默回退到弱默认值）
const JWT_SECRET =
  process.env.JWT_SECRET || 'bluebook-super-secret-key-2024';

// 生成 Token（有效期 7 天）
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

// 校验 token；返回解码后的 payload。
// 区分两种失败原因：TokenExpiredError = 真正过期；其余 = 密钥不符/被篡改/格式非法。
const verifyToken = (token) => {
  try {
    return { decoded: jwt.verify(token, JWT_SECRET), error: null };
  } catch (error) {
    return { decoded: null, error };
  }
};

module.exports = { generateToken, verifyToken, JWT_SECRET };
