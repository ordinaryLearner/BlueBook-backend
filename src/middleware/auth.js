// src/middleware/auth.js
const { verifyToken } = require('../utils/token');
const { userExists } = require('../models/user');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ code: 401, message: '请先登录' });
    }

    const token = authHeader.substring(7);
    
    // 统一从 utils/token 取值，避免与签发端密钥不一致
    const { decoded, error } = verifyToken(token);
    if (error) {
      console.error('认证失败:', error);
      const expired = error.name === 'TokenExpiredError';
      return res.status(401).json({
        code: 401,
        message: expired ? '登录已过期，请重新登录' : 'Token无效'
      });
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