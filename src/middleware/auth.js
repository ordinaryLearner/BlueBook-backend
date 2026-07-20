// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const { findById } = require('../models/user');

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

    const user = await findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ code: 401, message: '用户不存在' });
    }

    req.user = user;
    req.userId = user.id;
    
    next();
  } catch (error) {
    console.error('认证错误:', error);
    res.status(500).json({ code: 500, message: '认证失败' });
  }
};

module.exports = { authenticate };