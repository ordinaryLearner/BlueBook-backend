// src/controllers/messageController.js
const {
  MESSAGE_TYPE,
  UUID_RE,
  createMessage,
  findConversation,
  markConversationRead,
  takeUnreadMessages
} = require('../models/message');

// 归一化消息类型：接受 TEXT/POST/COMMENT（忽略大小写与空白），非法返回 null
const parseMessageType = (value) => {
  if (value == null || String(value).trim() === '') return MESSAGE_TYPE.TEXT;
  const normalized = String(value).trim().toUpperCase();
  return Object.values(MESSAGE_TYPE).includes(normalized) ? normalized : null;
};

// 兼容客户端把 receiver 整体序列化上传（receiver.id）或直接传顶层 receiverId
const extractReceiverId = (body) => {
  const direct = body.receiverId;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const receiver = body.receiver;
  if (typeof receiver === 'string' && receiver.trim()) return receiver.trim();
  if (receiver && typeof receiver === 'object' && typeof receiver.id === 'string') {
    return receiver.id.trim();
  }
  return '';
};

exports.sendMessage = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ code: 401, message: '请先登录' });
    }

    const body = req.body || {};
    const receiverId = extractReceiverId(body);
    const text = typeof body.text === 'string' ? body.text.trim() : '';

    if (!receiverId) {
      return res.status(400).json({ code: 400, message: '接收者ID(receiverId)不能为空' });
    }
    if (!UUID_RE.test(receiverId)) {
      return res.status(400).json({ code: 400, message: '接收者ID(receiverId)格式不正确' });
    }
    if (receiverId === req.userId) {
      return res.status(400).json({ code: 400, message: '不能给自己发送消息' });
    }

    const type = parseMessageType(body.type);
    if (type === null) {
      return res.status(400).json({ code: 400, message: 'type 只能是 TEXT、POST 或 COMMENT' });
    }

    // 正文必填：POST/COMMENT 类型也承载一段可展示文案，缺正文的消息客户端无法渲染
    if (!text) {
      return res.status(400).json({ code: 400, message: '消息内容(text)不能为空' });
    }

    let postId = body.postId ?? (body.post && body.post.id) ?? null;
    if (postId != null && String(postId).trim() === '') postId = null;
    if (postId != null) {
      postId = String(postId).trim();
      if (!UUID_RE.test(postId)) {
        return res.status(400).json({ code: 400, message: '帖子ID(postId)格式不正确' });
      }
    }

    // sender 以登录 token 为准，忽略请求体中的 sender，防止伪造发送者
    const message = await createMessage({
      id: body.id,
      senderId: req.userId,
      receiverId,
      postId,
      text,
      type
    });

    res.status(201).json({
      code: 200,
      message: '发送成功',
      data: message
    });
  } catch (error) {
    console.error('发送消息错误:', error);
    // 外键约束失败通常表示接收者（或帖子）不存在
    if (error.code === '23503') {
      return res.status(400).json({ code: 400, message: '接收者或关联帖子不存在' });
    }
    res.status(500).json({ code: 500, message: '发送失败，请稍后重试' });
  }
};

exports.getConversation = async (req, res) => {
  try {
    const otherId = (req.params.userId || '').trim();
    if (!otherId) {
      return res.status(400).json({ code: 400, message: '对方用户ID(userId)不能为空' });
    }
    if (!UUID_RE.test(otherId)) {
      return res.status(400).json({ code: 400, message: '对方用户ID(userId)格式不正确' });
    }

    const messages = await findConversation(req.userId, otherId);
    res.json({
      code: 200,
      message: 'success',
      data: messages
    });
  } catch (error) {
    console.error('获取会话消息错误:', error);
    res.status(500).json({ code: 500, message: '获取会话消息失败' });
  }
};

// 取当前用户收到的全部未读消息，返回的同时置为已读（读取与更新原子完成，不会重复返回）
exports.takeUnread = async (req, res) => {
  try {
    const messages = await takeUnreadMessages(req.userId);
    res.json({
      code: 200,
      message: 'success',
      data: messages
    });
  } catch (error) {
    console.error('获取未读消息错误:', error);
    res.status(500).json({ code: 500, message: '获取未读消息失败' });
  }
};

exports.markRead = async (req, res) => {
  try {
    const body = req.body || {};
    const otherId = extractReceiverId(body) || (typeof body.userId === 'string' ? body.userId.trim() : '');

    if (!otherId) {
      return res.status(400).json({ code: 400, message: '对方用户ID(userId)不能为空' });
    }
    if (!UUID_RE.test(otherId)) {
      return res.status(400).json({ code: 400, message: '对方用户ID(userId)格式不正确' });
    }

    const updated = await markConversationRead(req.userId, otherId);
    res.json({
      code: 200,
      message: '已读',
      data: { updated }
    });
  } catch (error) {
    console.error('标记已读错误:', error);
    res.status(500).json({ code: 500, message: '标记已读失败，请稍后重试' });
  }
};
