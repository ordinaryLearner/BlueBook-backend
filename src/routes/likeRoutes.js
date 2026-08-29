const router = require('express').Router();
const { likeTarget, unlikeTarget } = require('../controllers/likeController');

router.post('/', likeTarget);
router.delete('/', unlikeTarget);

module.exports = router;
