const { addLike, removeLike, findPostById, findFullCommentById } = require('../models/post');

// 校验 type/目标ID/userid，返回 { error } 或 { type, targetId, userId }
const parseLikeParams = (body) => {
  const { userid, type, postId, commentId } = body;

  const targetType = type === 'post' || type === 'comment' ? type : null;
  if (!targetType) return { error: '点赞对象类型 type 必须为 post 或 comment' };
  if (!userid) return { error: '用户ID(userid)不能为空' };

  const targetId = targetType === 'post' ? postId : commentId;
  if (!targetId) {
    return { error: targetType === 'post' ? '帖子ID(postId)不能为空' : '评论ID(commentId)不能为空' };
  }

  return { type: targetType, targetId, userId: userid };
};

const resolveLatest = (type, targetId) =>
  type === 'post' ? findPostById(targetId) : findFullCommentById(targetId);

exports.likeTarget = async (req, res) => {
  try {
    const params = parseLikeParams(req.body);
    if (params.error) {
      return res.status(400).json({ code: 400, message: params.error });
    }

    const updated = await addLike(params.type, params.targetId, params.userId);
    if (!updated) {
      return res.status(404).json({
        code: 404,
        message: params.type === 'post' ? '帖子不存在' : '评论不存在'
      });
    }

    res.status(201).json({
      code: 200,
      message: '点赞成功',
      data: await resolveLatest(params.type, params.targetId)
    });
  } catch (error) {
    console.error('点赞错误:', error);
    res.status(500).json({ code: 500, message: '点赞失败，请稍后重试' });
  }
};

exports.unlikeTarget = async (req, res) => {
  try {
    const params = parseLikeParams(req.body);
    if (params.error) {
      return res.status(400).json({ code: 400, message: params.error });
    }

    const updated = await removeLike(params.type, params.targetId, params.userId);
    if (!updated) {
      return res.status(404).json({
        code: 404,
        message: params.type === 'post' ? '帖子不存在' : '评论不存在'
      });
    }

    res.json({
      code: 200,
      message: '取消点赞成功',
      data: await resolveLatest(params.type, params.targetId)
    });
  } catch (error) {
    console.error('取消点赞错误:', error);
    res.status(500).json({ code: 500, message: '取消点赞失败，请稍后重试' });
  }
};
