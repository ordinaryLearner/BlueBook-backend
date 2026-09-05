const { findById, updateProfile, followUser, unfollowUser, isFollowing, listFollows } = require('../models/user');
const { generateToken } = require('../utils/token');

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

// ==================== 更新个人资料（用户名、头像、背景图、签名） ====================
exports.updateProfile = async (req, res) => {
  try {
    const { username, avatar, background, bio } = req.body;

    if (username === undefined && avatar === undefined && background === undefined && bio === undefined) {
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
      background,
      bio: bio !== undefined ? String(bio) : undefined
    });
    if (!updatedUser) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    res.json({
      code: 200,
      message: '更新成功',
      data: {
        user: updatedUser,
        token: generateToken(updatedUser.id)
      }
    });
  } catch (error) {
    console.error('更新个人资料错误:', error);
    res.status(500).json({ code: 500, message: '更新个人资料失败' });
  }
};

// ==================== 关注用户 ====================
exports.follow = async (req, res) => {
  try {
    const targetId = req.params.id;
    const userId = req.userId;

    if (userId === targetId) {
      return res.status(400).json({ code: 400, message: '不能关注自己' });
    }

    const target = await findById(targetId);
    if (!target) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    if (await isFollowing(userId, targetId)) {
      return res.status(400).json({ code: 400, message: '已关注该用户' });
    }

    await followUser(userId, targetId);
    res.json({ code: 200, message: '关注成功' });
  } catch (error) {
    console.error('关注用户错误:', error);
    res.status(500).json({ code: 500, message: '关注失败' });
  }
};

// ==================== 取消关注 ====================
exports.unfollow = async (req, res) => {
  try {
    const targetId = req.params.id;
    const userId = req.userId;

    if (!(await isFollowing(userId, targetId))) {
      return res.status(400).json({ code: 400, message: '未关注该用户' });
    }

    await unfollowUser(userId, targetId);
    res.json({ code: 200, message: '取消关注成功' });
  } catch (error) {
    console.error('取消关注错误:', error);
    res.status(500).json({ code: 500, message: '取消关注失败' });
  }
};

// ==================== 查询是否关注了某用户 ====================
exports.followStatus = async (req, res) => {
  try {
    const following = await isFollowing(req.userId, req.params.id);
    res.json({ code: 200, message: 'success', data: { following } });
  } catch (error) {
    console.error('查询关注状态错误:', error);
    res.status(500).json({ code: 500, message: '查询关注状态失败' });
  }
};

// ==================== 分页获取某用户的关注列表（我主动关注的 User） ====================
exports.getFollowingList = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10);
    const pageSize = parseInt(req.query.pageSize, 10);
    const data = await listFollows(
      req.params.id,
      'followers',
      Number.isNaN(page) ? 1 : page,
      Number.isNaN(pageSize) ? 30 : pageSize
    );
    if (!data) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }
    res.json({ code: 200, message: 'success', data });
  } catch (error) {
    console.error('获取关注列表错误:', error);
    res.status(500).json({ code: 500, message: '获取关注列表失败' });
  }
};

// ==================== 分页获取某用户的粉丝列表（关注该用户的 User） ====================
exports.getFansList = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10);
    const pageSize = parseInt(req.query.pageSize, 10);
    const data = await listFollows(
      req.params.id,
      'fans',
      Number.isNaN(page) ? 1 : page,
      Number.isNaN(pageSize) ? 30 : pageSize
    );
    if (!data) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }
    res.json({ code: 200, message: 'success', data });
  } catch (error) {
    console.error('获取粉丝列表错误:', error);
    res.status(500).json({ code: 500, message: '获取粉丝列表失败' });
  }
};

