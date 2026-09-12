const router = require('express').Router();
const messageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/auth');

// 上传一条消息并保存（sender 以登录 token 为准）
router.post('/', authenticate, messageController.sendMessage);
// 获取当前用户全部未读消息，并在返回同时标记为已读（返回后不再重复下发）
router.get('/unread', authenticate, messageController.takeUnread);
router.post('/unread', authenticate, messageController.takeUnread);
// 由两个用户 ID 推导会话 ID（公开：纯计算，不涉及用户数据）
router.post('/conversation-id', messageController.getConversationId);
// 获取与指定用户(userId)的会话消息列表
router.get('/conversation/:userId', authenticate, messageController.getConversation);
// 将对方(userId)发来的消息批量标记为已读
router.post('/read', authenticate, messageController.markRead);

module.exports = router;
