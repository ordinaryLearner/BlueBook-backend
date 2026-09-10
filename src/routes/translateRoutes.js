const router = require('express').Router();
const translateController = require('../controllers/translateController');

// 文本翻译（公开接口）
router.post('/', translateController.translateText);

module.exports = router;
