const axios = require('axios');
const FormData = require('form-data');
const { createPost, findAllPosts, findPostById, findRandomRecentPosts } = require('../models/post');

const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

const uploadToImgBB = async (fileBuffer, fileName) => {
  const formData = new FormData();
  formData.append('image', fileBuffer, { filename: fileName || 'image.jpg' });

  const response = await axios.post(
    `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
    formData,
    { headers: formData.getHeaders() }
  );

  return response.data.data.url;
};

exports.createPost = async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!req.userId) {
      return res.status(401).json({ code: 401, message: '请先登录' });
    }

    const imageUrls = [];

    if (req.body.imageUrls) {
      let urls = req.body.imageUrls;
      if (typeof urls === 'string') {
        try { urls = JSON.parse(urls); } catch (e) { urls = [urls]; }
      }
      if (Array.isArray(urls)) {
        imageUrls.push(...urls);
      }
    }

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const url = await uploadToImgBB(file.buffer, file.originalname);
        imageUrls.push(url);
      }
    } else if (req.body.images) {
      let images = req.body.images;
      if (typeof images === 'string') {
        try { images = JSON.parse(images); } catch (e) { images = [images]; }
      }
      if (Array.isArray(images)) {
        for (const img of images) {
          const url = await uploadToImgBB(Buffer.from(img, 'base64'), 'image.jpg');
          imageUrls.push(url);
        }
      }
    }

    const post = await createPost(
      title || '',
      content,
      req.userId,
      imageUrls
    );

    const fullPost = await findPostById(post.id);

    res.status(201).json({
      code: 200,
      message: '发布成功',
      data: fullPost
    });
  } catch (error) {
    console.error('发布帖子错误:', error);
    if (error.response) {
      console.error('ImgBB error:', error.response.data);
    }
    res.status(500).json({ code: 500, message: '发布失败，请稍后重试' });
  }
};

exports.getPosts = async (req, res) => {
  try {
    const posts = await findAllPosts();
    res.json({
      code: 200,
      message: 'success',
      data: posts
    });
  } catch (error) {
    console.error('获取帖子列表错误:', error);
    res.status(500).json({ code: 500, message: '获取帖子列表失败' });
  }
};

exports.getRandomPosts = async (req, res) => {
  try {
    const posts = await findRandomRecentPosts(10);
    res.json({
      code: 200,
      message: 'success',
      data: posts
    });
  } catch (error) {
    console.error('获取随机帖子错误:', error);
    res.status(500).json({ code: 500, message: '获取随机帖子失败' });
  }
};

exports.getPostById = async (req, res) => {
  try {
    const post = await findPostById(req.params.id);
    if (!post) {
      return res.status(404).json({ code: 404, message: '帖子不存在' });
    }
    res.json({
      code: 200,
      message: 'success',
      data: post
    });
  } catch (error) {
    console.error('获取帖子详情错误:', error);
    res.status(500).json({ code: 500, message: '获取帖子详情失败' });
  }
};
