// src/controllers/translateController.js
const { translate } = require('../utils/volcTranslate');

const MAX_TEXT_LENGTH = 5000;

// ==================== 文本翻译 ====================
exports.translateText = async (req, res) => {
  try {
    const { text } = req.body;
    if (typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ code: 400, message: '翻译内容不能为空' });
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({ code: 400, message: `翻译内容长度不能超过${MAX_TEXT_LENGTH}个字符` });
    }

    const { translation, error } = await translate(text);
    if (error || !translation) {
      // 具体的上游失败原因通过 data.reason 返回，便于客户端/联调时定位（message 仍是给用户看的友好文案）
      return res.status(500).json({ code: 500, message: '翻译失败，请稍后重试', data: { reason: error || '响应中无翻译结果' } });
    }

    res.json({ code: 200, message: 'success', data: { translation } });
  } catch (error) {
    console.error('翻译错误:', error);
    res.status(500).json({ code: 500, message: '翻译失败，请稍后重试' });
  }
};
