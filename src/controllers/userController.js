const { findById, updateProfile } = require('../models/user');

exports.getUserById = async (req, res) => {
  try {
    const user = await findById(req.params.id);
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

// ==================== 更新个人资料（用户名、头像、签名） ====================
exports.updateProfile = async (req, res) => {
  try {
    const { username, avatar, bio } = req.body;

    if (username === undefined && avatar === undefined && bio === undefined) {
      return res.status(400).json({ code: 400, message: '没有需要更新的内容' });
    }

    if (username !== undefined && !String(username).trim()) {
      return res.status(400).json({ code: 400, message: '用户名不能为空' });
    }

    if (String(username || '').trim().length > 100) {
      return res.status(400).json({ code: 400, message: '用户名长度不能超过100个字符' });
    }

    if (String(bio ?? '').length > 200) {
      return res.status(400).json({ code: 400, message: '签名长度不能超过200个字符' });
    }

    const updatedUser = await updateProfile(req.userId, {
      username: username !== undefined ? String(username).trim() : undefined,
      avatar,
      bio: bio !== undefined ? String(bio) : undefined
    });
    if (!updatedUser) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    res.json({
      code: 200,
      message: '更新成功',
      data: updatedUser
    });
  } catch (error) {
    console.error('更新个人资料错误:', error);
    res.status(500).json({ code: 500, message: '更新个人资料失败' });
  }
};
