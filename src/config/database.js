// src/config/database.js
const { Pool } = require('pg');
require('dotenv').config();

// 创建连接池 - 支持 DATABASE_URL 和独立参数两种方式
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
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

// 创建 users 表
const initDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        account VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        username VARCHAR(100),
        avatar TEXT,
        bio TEXT,
        join_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Database table initialized successfully');
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