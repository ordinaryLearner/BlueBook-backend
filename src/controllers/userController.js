const { findById } = require('../models/user');

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
