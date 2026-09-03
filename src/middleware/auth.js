// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { userExists } = require('../models/user');

const JWT_SECRET = process.env.JWT_SECRET || 'bluebook-super-secret-key-2024';

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ code: 401, message: '请先登录' });
    }

    const token = authHeader.substring(7);
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ code: 401, message: 'Token无效或已过期' });
    }

    // 轻量校验用户仍存在，避免每个认证请求都做关注列表的联表开销
    if (!(await userExists(decoded.userId))) {
      return res.status(401).json({ code: 401, message: '用户不存在' });
    }

    req.userId = decoded.userId;
    req.user = { id: decoded.userId };
    
    next();
  } catch (error) {
    console.error('认证错误:', error);
    res.status(500).json({ code: 500, message: '认证失败' });
  }
};

module.exports = { authenticate };