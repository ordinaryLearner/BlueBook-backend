// src/config/database.js
const { Pool } = require('pg');
require('dotenv').config();

// 创建连接池 - 支持 DATABASE_URL 和独立参数两种方式
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  options: '-c timezone=Asia/Shanghai'
});

// 如果使用独立参数（本地开发），覆盖连接配置
if (!process.env.DATABASE_URL) {
  pool.options.host = process.env.DB_HOST || 'localhost';
  pool.options.port = process.env.DB_PORT || 5432;
  pool.options.user = process.env.DB_USER || 'postgres';
  pool.options.password = process.env.DB_PASSWORD || '';
  pool.options.database = process.env.DB_NAME || 'bluebook';
  pool.options.ssl = false;
}

// 初始化所有表
const initDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account    VARCHAR(100) UNIQUE NOT NULL,
        password   VARCHAR(255) NOT NULL,
        username   VARCHAR(100),
        avatar     TEXT,
        bio        TEXT,
        join_time  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title      VARCHAR(255) NOT NULL DEFAULT '',
        content    TEXT NOT NULL DEFAULT '',
        sender_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        likes      JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS post_medias (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        type       VARCHAR(10) NOT NULL DEFAULT 'IMAGE',
        url        TEXT NOT NULL,
        sort_order INT DEFAULT 0
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
        parent_id   UUID REFERENCES comments(id) ON DELETE CASCADE,
        receiver_id UUID REFERENCES users(id),
        content     TEXT NOT NULL,
        sender_id   UUID NOT NULL REFERENCES users(id),
        likes       INT DEFAULT 0,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 兼容已存在的表：幂等补充 parent_id 列，用于支持回复（嵌套评论）
    await pool.query(`
      ALTER TABLE comments
      ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE
    `);

    // 兼容已存在的表：幂等补充 receiver_id 列，用于记录回复中被回复的用户
    await pool.query(`
      ALTER TABLE comments
      ADD COLUMN IF NOT EXISTS receiver_id UUID REFERENCES users(id)
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error.message);
  }
};

// 测试连接
const testConnection = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('Database connected successfully');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error.message);
    return false;
  }
};

module.exports = { pool, initDatabase, testConnection };