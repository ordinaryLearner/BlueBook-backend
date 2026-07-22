# BlueBook Auth - 小蓝书认证服务

基于 Express + PostgreSQL + JWT 的认证微服务。

## 技术栈

- **运行时:** Node.js
- **框架:** Express ^4.18.2
- **数据库:** PostgreSQL（pg ^8.11.0）
- **认证:** JSON Web Token（jsonwebtoken ^9.0.0）
- **其他:** cors, dotenv

## 快速开始

```bash
# 安装依赖
npm install

# 配置环境变量（复制 .env 并按需修改）
# 确保 DATABASE_URL 或各 DB_* 变量正确指向 PostgreSQL

# 启动（开发模式，自动重启）
npm run dev

# 启动（生产模式）
npm start
```

## 部署地址

- **生产环境（Render）:** `https://bluebook-backend-at73.onrender.com`
- **本地开发:** `http://localhost:3000`

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `JWT_SECRET` | JWT 签名密钥 | `bluebook-super-secret-key-2024`（开发用） |
| `DATABASE_URL` | PostgreSQL 连接串（优先） | - |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | 数据库独立参数（`DATABASE_URL` 为空时生效） | `localhost` / `5432` / `postgres` / 空 / `bluebook` |
| `NODE_ENV` | 运行环境，`production` 时启用 SSL | - |

## API 文档

所有接口统一返回格式：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

错误时返回（示例）：

```json
{
  "code": 401,
  "message": "账号或密码错误"
}
```

---

### 1. 健康检查

```
GET /health
```

无需认证。用于检查服务是否正常运行。

**Response `200`:**

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

### 2. 注册

```
POST /api/auth/register
Content-Type: application/json
```

**Request Body:**

```json
{
  "account": "user123",
  "password": "password123"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `account` | string | 是 | 登录账号，唯一 |
| `password` | string | 是 | 密码，至少 6 位 |

昵称由服务端自动生成，格式为 `user` + 基于当前时间的 6 位随机数。

**Response `201`:**

```json
{
  "code": 200,
  "message": "注册成功",
  "data": {
    "user": {
      "id": "uuid",
      "account": "user123",
      "username": "用户847251",
      "avatar": null,
      "bio": null,
      "join_time": "2024-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**错误码：**

| 状态码 | code | message |
|--------|------|---------|
| 400 | 400 | 账号和密码不能为空 |
| 400 | 400 | 密码长度不能少于6位 |
| 409 | 409 | 该账号已被注册 |

---

### 3. 登录

```
POST /api/auth/login
Content-Type: application/json
```

**Request Body:**

```json
{
  "account": "user123",
  "password": "password123"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `account` | string | 是 | 登录账号 |
| `password` | string | 是 | 密码 |

**Response `200`:**

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "user": {
      "id": "uuid",
      "account": "user123",
      "username": "张三",
      "avatar": null,
      "bio": null,
      "join_time": "2024-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**错误码：**

| 状态码 | code | message |
|--------|------|---------|
| 400 | 400 | 账号和密码不能为空 |
| 401 | 401 | 账号或密码错误 |

---

### 4. 获取当前用户（自动登录）

```
GET /api/auth/me
Authorization: Bearer <token>
```

需要认证。前端可用此接口实现自动登录 —— 将登录时保存的 token 放在请求头中调用，验证通过则恢复用户会话。

**Response `200`:**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "uuid",
    "account": "user123",
    "username": "张三",
    "avatar": null,
    "bio": null,
    "join_time": "2024-01-01T00:00:00.000Z"
  }
}
```

**错误码：**

| 状态码 | code | message |
|--------|------|---------|
| 401 | 401 | 请先登录 |
| 401 | 401 | Token无效或已过期 |
| 401 | 401 | 用户不存在 |
| 404 | 404 | 用户不存在 |

## 自动登录流程（前端参考）

1. 用户首次登录，调用 `POST /api/auth/login`，获取 `token` 并保存到本地（如 localStorage）。
2. 每次 App 启动时，从本地取出 `token`，调用 `GET /api/auth/me`（携带 `Authorization: Bearer <token>`）。
3. 若接口返回 200，表示 token 有效，用户自动登录成功。
4. 若返回 401，表示 token 无效或已过期，跳转到登录页。

Token 有效期：**7 天**，过期后需重新登录。

## 数据库表结构

```sql
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account    VARCHAR(100) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,
  username   VARCHAR(100),
  avatar     TEXT,
  bio        TEXT,
  join_time  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
