// src/config/database.js
const { Pool } = require('pg');
require('dotenv').config();

// 创建连接池
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bluebook',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// 创建 users 表
const initDatabase = async () => {
  try {
    await pool.query(\
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
    \);
    console.log('✅ 数据库表初始化成功');
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error.message);
  }
};

// 测试连接
const testConnection = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ 数据库连接成功');
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    return false;
  }
};

module.exports = { pool, initDatabase, testConnection };
