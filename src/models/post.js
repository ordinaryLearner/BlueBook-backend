const { pool } = require('../config/database');

const createPost = async (title, content, senderId, imageUrls) => {
  const postResult = await pool.query(
    'INSERT INTO posts (title, content, sender_id) VALUES ($1, $2, $3) RETURNING *',
    [title, content, senderId]
  );
  const post = postResult.rows[0];

  for (let i = 0; i < imageUrls.length; i++) {
    await pool.query(
      'INSERT INTO post_medias (post_id, type, url, sort_order) VALUES ($1, $2, $3, $4)',
      [post.id, 'IMAGE', imageUrls[i], i]
    );
  }

  return post;
};

const findAllPosts = async () => {
  const result = await pool.query(`
    SELECT p.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'account', u.account,
        'avatar', u.avatar,
        'bio', u.bio,
        'join_time', u.join_time
      ) as sender
    FROM posts p
    JOIN users u ON p.sender_id = u.id
    ORDER BY p.created_at DESC
  `);

  const posts = result.rows;

  for (const post of posts) {
    const mediasResult = await pool.query(
      'SELECT id, type, url FROM post_medias WHERE post_id = $1 ORDER BY sort_order',
      [post.id]
    );
    post.medias = mediasResult.rows;

    const commentsResult = await pool.query(`
      SELECT c.*,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'account', u.account,
          'avatar', u.avatar
        ) as sender
      FROM comments c
      JOIN users u ON c.sender_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC
    `, [post.id]);
    post.comments = commentsResult.rows;
  }

  return posts;
};

const findPostById = async (id) => {
  const result = await pool.query(`
    SELECT p.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'account', u.account,
        'avatar', u.avatar,
        'bio', u.bio,
        'join_time', u.join_time
      ) as sender
    FROM posts p
    JOIN users u ON p.sender_id = u.id
    WHERE p.id = $1
  `, [id]);

  if (result.rows.length === 0) return null;

  const post = result.rows[0];

  const mediasResult = await pool.query(
    'SELECT id, type, url FROM post_medias WHERE post_id = $1 ORDER BY sort_order',
    [post.id]
  );
  post.medias = mediasResult.rows;

  const commentsResult = await pool.query(`
    SELECT c.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'account', u.account,
        'avatar', u.avatar
      ) as sender
    FROM comments c
    JOIN users u ON c.sender_id = u.id
    WHERE c.post_id = $1
    ORDER BY c.created_at ASC
  `, [post.id]);
  post.comments = commentsResult.rows;

  return post;
};

const findPostsByUserId = async (userId) => {
  const result = await pool.query(`
    SELECT p.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'account', u.account,
        'avatar', u.avatar,
        'bio', u.bio,
        'join_time', u.join_time
      ) as sender
    FROM posts p
    JOIN users u ON p.sender_id = u.id
    WHERE p.sender_id = $1
    ORDER BY p.created_at DESC
  `, [userId]);

  const posts = result.rows;

  for (const post of posts) {
    const mediasResult = await pool.query(
      'SELECT id, type, url FROM post_medias WHERE post_id = $1 ORDER BY sort_order',
      [post.id]
    );
    post.medias = mediasResult.rows;

    const commentsResult = await pool.query(`
      SELECT c.*,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'account', u.account,
          'avatar', u.avatar
        ) as sender
      FROM comments c
      JOIN users u ON c.sender_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC
    `, [post.id]);
    post.comments = commentsResult.rows;
  }

  return posts;
};

const findRandomRecentPosts = async (limit = 10) => {
  const result = await pool.query(`
    SELECT p.*,
      json_build_object(
        'id', u.id,
        'username', u.username,
        'account', u.account,
        'avatar', u.avatar,
        'bio', u.bio,
        'join_time', u.join_time
      ) as sender
    FROM (
      SELECT * FROM posts ORDER BY created_at DESC LIMIT 100
    ) p
    JOIN users u ON p.sender_id = u.id
    ORDER BY RANDOM()
    LIMIT $1
  `, [limit]);

  const posts = result.rows;

  for (const post of posts) {
    const mediasResult = await pool.query(
      'SELECT id, type, url FROM post_medias WHERE post_id = $1 ORDER BY sort_order',
      [post.id]
    );
    post.medias = mediasResult.rows;

    const commentsResult = await pool.query(`
      SELECT c.*,
        json_build_object(
          'id', u.id,
          'username', u.username,
          'account', u.account,
          'avatar', u.avatar
        ) as sender
      FROM comments c
      JOIN users u ON c.sender_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC
    `, [post.id]);
    post.comments = commentsResult.rows;
  }

  return posts;
};

module.exports = { createPost, findAllPosts, findPostById, findPostsByUserId, findRandomRecentPosts };
