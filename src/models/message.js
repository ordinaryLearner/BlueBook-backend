// src/models/message.js
const { pool } = require('../config/database');
const { formatTime } = require('../utils/time');

// 客户端 MessageType 枚举，与客户端 data class 保持一致
const MESSAGE_TYPE = { TEXT: 'TEXT', POST: 'POST', COMMENT: 'COMMENT' };

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// 会话 ID 由收发双方用户 ID 推导：排序后拼接，保证同一对用户无论谁发起都得到同一个值。
// uuid 文本比较大小写无关的十六进制串，排序结果稳定。
const buildConversationId = (userA, userB) => {
  const a = String(userA).toLowerCase();
  const b = String(userB).toLowerCase();
  return a <= b ? `${a}_${b}` : `${b}_${a}`;
};

// sender/receiver 只存用户 ID，返回时 JOIN users 展开为精简 User 对象
const SENDER_JSON = `json_build_object(
  'id', su.id,
  'username', su.username,
  'account', su.account,
  'avatar', su.avatar
)`;

const RECEIVER_JSON = `json_build_object(
  'id', ru.id,
  'username', ru.username,
  'account', ru.account,
  'avatar', ru.avatar
)`;

// 将数据库行按客户端 Message 字段命名返回（is_read -> isRead，created_at -> time）
const formatMessage = (row) => {
  if (!row) return null;
  if (row.sender && row.sender.join_time) row.sender.join_time = formatTime(row.sender.join_time);
  return {
    id: row.id,
    conversationId: row.conversation_id,
    postId: row.post_id || null,
    sender: row.sender,
    receiver: row.receiver,
    text: row.text,
    time: formatTime(row.created_at),
    isRead: row.is_read,
    type: row.type
  };
};

const BASE_SELECT = `
  SELECT m.*, ${SENDER_JSON} AS sender, ${RECEIVER_JSON} AS receiver
  FROM messages m
  JOIN users su ON m.sender_id = su.id
  JOIN users ru ON m.receiver_id = ru.id
`;

// 创建消息：客户端可自带 UUID 主键（Room 本地已生成），否则由数据库生成。
// time 一律由服务端 created_at 决定，避免客户端时间不可信。
// conversationId 由服务端按收发双方推导，不接受客户端上传值。
const createMessage = async ({ id, senderId, receiverId, postId = null, text, type = MESSAGE_TYPE.TEXT }) => {
  const useClientId = typeof id === 'string' && UUID_RE.test(id.trim());
  const conversationId = buildConversationId(senderId, receiverId);
  const result = await pool.query(
    `INSERT INTO messages (id, conversation_id, sender_id, receiver_id, post_id, text, type)
     VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [useClientId ? id.trim() : null, conversationId, senderId, receiverId, postId, text, type]
  );
  return findMessageById(result.rows[0].id);
};

const findMessageById = async (id) => {
  const result = await pool.query(`${BASE_SELECT} WHERE m.id = $1`, [id]);
  return formatMessage(result.rows[0] || null);
};

// 返回两人之间的双向会话消息，按时间正序。
// 直接用推导出的 conversation_id 命中索引，无需 OR 条件扫描。
const findConversation = async (userId, otherId) => {
  const result = await pool.query(
    `${BASE_SELECT}
     WHERE m.conversation_id = $1
     ORDER BY m.created_at ASC`,
    [buildConversationId(userId, otherId)]
  );
  return result.rows.map(formatMessage);
};

// 把对方发给当前用户的未读消息批量置为已读，返回更新条数
const markConversationRead = async (userId, otherId) => {
  const result = await pool.query(
    `UPDATE messages
     SET is_read = true
     WHERE conversation_id = $1 AND receiver_id = $2 AND is_read = false`,
    [buildConversationId(userId, otherId), userId]
  );
  return result.rowCount;
};

// 取当前用户收到的全部未读消息并同时标记为已读，返回消息列表（按时间正序）。
// 用 UPDATE ... RETURNING：读取与置已读在同一条语句里完成，天然原子，
// 并发调用时后到者拿到的是空结果，不会重复返回同一批消息。
const takeUnreadMessages = async (userId) => {
  const result = await pool.query(
    `WITH taken AS (
       UPDATE messages
       SET is_read = true
       WHERE receiver_id = $1 AND is_read = false
       RETURNING *
     )
     SELECT t.*, ${SENDER_JSON} AS sender, ${RECEIVER_JSON} AS receiver
     FROM taken t
     JOIN users su ON t.sender_id = su.id
     JOIN users ru ON t.receiver_id = ru.id
     ORDER BY t.created_at ASC`,
    [userId]
  );
  return result.rows.map(formatMessage);
};

module.exports = {
  MESSAGE_TYPE,
  UUID_RE,
  buildConversationId,
  createMessage,
  findMessageById,
  findConversation,
  markConversationRead,
  takeUnreadMessages
};
