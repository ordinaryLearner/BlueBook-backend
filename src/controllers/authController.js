// src/controllers/authController.js
const jwt = require('jsonwebtoken');
const { findByAccount, createUser, findById } = require('../models/user');

const JWT_SECRET = process.env.JWT_SECRET || 'bluebook-super-secret-key-2024';

// 生成 Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

// ==================== 注册 ====================
exports.register = async (req, res) => {
  try {
    const { account, password } = req.body;

    // 验证
    if (!account || !password) {
      return res.status(400).json({ 
        code: 400, 
        message: '账号和密码不能为空' 
      });
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        code: 400, 
        message: '密码长度不能少于6位' 
      });
    }

    // 检查账号是否已存在
    const existingUser = await findByAccount(account);
    if (existingUser) {
      return res.status(409).json({ 
        code: 409, 
        message: '该账号已被注册' 
      });
    }

    // 基于当前时间生成6位随机数，昵称 = user + 6位随机数
    const suffix = String(Date.now() % 1000000).padStart(6, '0');
    const username = `用户${suffix}`;

    // 创建用户 (密码明文存储)
    const newUser = await createUser(account, password, username);

    // 生成 Token
    const token = generateToken(newUser.id);

    res.status(201).json({
      code: 200,
      message: '注册成功',
      data: {
        user: newUser,
        token
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ code: 500, message: '注册失败，请稍后重试' });
  }
};

// ==================== 登录 ====================
exports.login = async (req, res) => {
  try {
    const { account, password } = req.body;

    if (!account || !password) {
      return res.status(400).json({ 
        code: 400, 
        message: '账号和密码不能为空' 
      });
    }

    // 查找用户
    const user = await findByAccount(account);
    if (!user) {
      return res.status(401).json({ 
        code: 401, 
        message: '账号或密码错误' 
      });
    }

    // 验证密码 (明文对比)
    if (user.password !== password) {
      return res.status(401).json({ 
        code: 401, 
        message: '账号或密码错误' 
      });
    }

    // 生成 Token
    const token = generateToken(user.id);

    // 返回用户信息 (不包含密码)
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      code: 200,
      message: '登录成功',
      data: {
        user: userWithoutPassword,
        token
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ code: 500, message: '登录失败，请稍后重试' });
  }
};

// ==================== 获取当前用户 ====================
exports.getCurrentUser = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ code: 400, message: 'Token不能为空' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ code: 401, message: 'Token无效或已过期' });
    }

    const user = await findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    res.json({
      code: 200,
      message: 'success',
      data: user
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ code: 500, message: '获取用户信息失败' });
  }
};