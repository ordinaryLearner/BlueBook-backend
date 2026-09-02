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
| `IMGBB_API_KEY` | ImgBB 图床 API 密钥（用于图片上传） | `d35841f781c7eb9c8bd4f0e6f6d00b6a` |

## API 文档

所有接口统一返回格式：

```json
{
  "code": 200,
  "message": "操作成功",
  "data": { ... }
}
```

**时间格式：** 帖子、评论、用户等数据中的时间字段（`created_at` / `updated_at` / `join_time` / `time`）统一为固定格式 `yyyy-MM-dd HH:mm:ss`（如 `2024-01-01 12:00:00`），由服务端在写入数据时记录并格式化返回。仅 `/health` 返回 ISO 8601 时间戳。

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
  "timestamp": "2024-08-17T12:34:56.789Z"
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
      "background": null,
      "bio": null,
      "join_time": "2024-01-01 00:00:00"
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
      "background": null,
      "bio": null,
      "join_time": "2024-01-01 00:00:00"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**错误码：**

| 状态码 | code | message |
|--------|------|---------|
| 400 | 400 | 账号和密码不能为空 |
| 404 | 404 | 用户不存在 |
| 401 | 401 | 账号或密码错误 |

---

### 4. 自动登录

```
POST /api/auth/auto_login
Content-Type: application/json
```

接收 `account` 和 `token`，先检索数据库确认用户存在，再验证 token 是否有效且属于该用户。

**Request Body:**

```json
{
  "account": "user123",
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `account` | string | 是 | 登录账号 |
| `token` | string | 是 | 登录时获取的 JWT |

**Response `200`:**

```json
{
  "code": 200,
  "message": "自动登录成功",
  "data": {
    "user": {
      "id": "uuid",
      "account": "user123",
      "username": "张三",
      "avatar": null,
      "background": null,
      "bio": null,
      "join_time": "2024-01-01 00:00:00"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**错误码：**

| 状态码 | code | message |
|--------|------|---------|
| 400 | 400 | 账号和Token不能为空 |
| 401 | 401 | 用户不存在 |
| 401 | 401 | Token无效或已过期 |
| 401 | 401 | Token与账号不匹配 |

---

### 5. 获取当前用户

```
POST /api/auth/me
Content-Type: application/json
```

仅通过 token 获取用户信息。

**Request Body:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `token` | string | 是 | 登录时获取的 JWT |

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
    "background": null,
    "bio": null,
    "join_time": "2024-01-01 00:00:00"
  }
}
```

**错误码：**

| 状态码 | code | message |
|--------|------|---------|
| 400 | 400 | Token不能为空 |
| 401 | 401 | Token无效或已过期 |
| 404 | 404 | 用户不存在 |

---

### 6. 发布帖子

```
POST /api/posts
Authorization: Bearer <token>
Content-Type: application/json
```

需要登录。文本内容（title/content/sender_id）存入数据库，图片直接以 **URL 数组**的形式保存，不存储图片文件。

**Request Body（JSON）：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | string | 否 | 帖子标题 |
| `content` | string | 否 | 帖子正文内容 |
| `images` | string[] | 否 | 图片 URL 数组，直接保存到数据库，不经过任何图床上传 |
| `imageUrls` | string[] | 否 | 同上，与 `images` 二选一或同时使用，最终合并保存 |

```json
{
  "title": "标题",
  "content": "正文",
  "images": ["https://example.com/image1.jpg", "https://example.com/image2.jpg"]
}
```

**Response `201`：**

```json
{
  "code": 200,
  "message": "发布成功",
  "data": {
    "id": "uuid",
    "title": "标题",
    "content": "正文",
    "sender": {
      "id": "uuid",
      "username": "用户名",
      "account": "账号",
      "avatar": null,
      "background": null,
      "bio": null,
      "join_time": "2024-01-01 00:00:00"
    },
    "medias": [
      {
        "id": "uuid",
        "type": "IMAGE",
        "url": "https://example.com/image1.jpg"
      }
    ],
    "likes": [],
    "comments": [],
    "time": "2024-01-01 00:00:00",
    "created_at": "2024-01-01 00:00:00",
    "updated_at": "2024-01-01 00:00:00"
  }
}
```

**错误码：**

| 状态码 | code | message |
|--------|------|---------|
| 401 | 401 | 请先登录 |
| 500 | 500 | 发布失败，请稍后重试 |

---

### 7. 获取帖子列表

```
GET /api/posts
```

无需登录。返回所有帖子，按创建时间倒序。

**Response `200`：** 每条帖子的 `comments` 为**嵌套评论树**，按时间正序排列——每条评论的 `comments` 字段存放其下所有回复，根评论无 `parentId` 字段。

```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "5c8b3d1e-9a2f-4c7e-b6d0-1a2b3c4d5e6f",
      "title": "今天去了海边",
      "content": "海边的日落真的很好看！",
      "sender": {
        "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        "username": "张三",
        "account": "user123",
        "avatar": "https://i.ibb.co/xxx/avatar.jpg",
        "background": "https://i.ibb.co/xxx/background.jpg",
        "bio": "热爱生活",
        "join_time": "2024-01-01 00:00:00"
      },
      "medias": [
        {
          "id": "f1e2d3c4-b5a6-4c7e-8d9e-0f1a2b3c4d5e",
          "type": "IMAGE",
          "url": "https://i.ibb.co/w04Prt6/c1f64245afb2.jpg"
        }
      ],
      "likes": [
        {
          "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
          "username": "张三",
          "account": "user123",
          "avatar": "https://i.ibb.co/xxx/avatar.jpg"
        }
      ],
      "comments": [
        {
          "id": "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f",
          "content": "拍得真好看！",
          "time": "2024-01-01 00:00:00",
          "type": "POSTCOMMENT",
          "sender": {
            "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
            "username": "李四",
            "account": "user456",
            "avatar": null
          },
          "receiver": null,
          "likes": [
            {
              "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
              "username": "李四",
              "account": "user456",
              "avatar": null
            },
            {
              "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
              "username": "张三",
              "account": "user123",
              "avatar": "https://i.ibb.co/xxx/avatar.jpg"
            }
          ],
          "comments": [
            {
              "id": "d4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a",
              "content": "谢谢～",
              "time": "2024-01-01 01:00:00",
              "type": "REPLYCOMMENT",
              "sender": {
                "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
                "username": "张三",
                "account": "user123",
                "avatar": "https://i.ibb.co/xxx/avatar.jpg"
              },
              "receiver": {
                "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
                "username": "李四",
                "account": "user456",
                "avatar": null
              },
              "likes": [
                {
                  "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
                  "username": "李四",
                  "account": "user456",
                  "avatar": null
                }
              ],
              "comments": []
            }
          ]
        }
      ],
      "time": "2024-01-01 00:00:00",
      "created_at": "2024-01-01 00:00:00",
      "updated_at": "2024-01-01 00:00:00"
    }
  ]
}
```

---

### 8. 获取帖子详情

```
GET /api/posts/:id
```

无需登录。

**Response `200`：** 返回单个完整帖子对象（结构与上面 data 中的元素一致），其 `comments` 同样为嵌套评论树，示例：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "5c8b3d1e-9a2f-4c7e-b6d0-1a2b3c4d5e6f",
    "title": "今天去了海边",
    "content": "海边的日落真的很好看！",
    "sender": {
      "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      "username": "张三",
      "account": "user123",
      "avatar": "https://i.ibb.co/xxx/avatar.jpg",
      "background": "https://i.ibb.co/xxx/background.jpg",
      "bio": "热爱生活",
      "join_time": "2024-01-01 00:00:00"
    },
    "medias": [
      {
        "id": "f1e2d3c4-b5a6-4c7e-8d9e-0f1a2b3c4d5e",
        "type": "IMAGE",
        "url": "https://i.ibb.co/w04Prt6/c1f64245afb2.jpg"
      }
    ],
    "likes": [
      {
        "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        "username": "张三",
        "account": "user123",
        "avatar": "https://i.ibb.co/xxx/avatar.jpg"
      }
    ],
    "comments": [
      {
        "id": "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f",
        "content": "拍得真好看！",
        "time": "2024-01-01 00:00:00",
        "type": "POSTCOMMENT",
        "sender": {
          "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
          "username": "李四",
          "account": "user456",
          "avatar": null
        },
        "receiver": null,
        "likes": [
          {
            "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
            "username": "李四",
            "account": "user456",
            "avatar": null
          },
          {
            "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
            "username": "张三",
            "account": "user123",
            "avatar": "https://i.ibb.co/xxx/avatar.jpg"
          }
        ],
        "comments": [
          {
            "id": "d4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a",
            "content": "谢谢～",
            "time": "2024-01-01 01:00:00",
            "type": "REPLYCOMMENT",
            "sender": {
              "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
              "username": "张三",
              "account": "user123",
              "avatar": "https://i.ibb.co/xxx/avatar.jpg"
            },
            "receiver": {
              "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
              "username": "李四",
              "account": "user456",
              "avatar": null
            },
            "likes": [
              {
                "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
                "username": "李四",
                "account": "user456",
                "avatar": null
              }
            ],
            "comments": []
          }
        ]
      }
    ],
    "time": "2024-01-01 00:00:00",
    "created_at": "2024-01-01 00:00:00",
    "updated_at": "2024-01-01 00:00:00"
  }
}
```

**Comment 字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 评论 ID |
| `content` | string | 评论内容 |
| `time` | string | 评论时间 |
| `type` | string | 评论类型：`POSTCOMMENT`（评论帖子）/ `REPLYCOMMENT`（回复评论） |
| `sender` | object | 评论者信息（`id` / `username` / `account` / `avatar`） |
| `receiver` | object | 被回复者信息（`id` / `username` / `account` / `avatar`）；`REPLYCOMMENT` 时返回，根评论为 `null` |
| `likes` | array | 点赞用户列表（User 对象数组，元素含 `id` / `username` / `account` / `avatar`） |
| `comments` | array | 该评论下的回复（嵌套评论树，可能为空数组） |

**错误码：**

| 状态码 | code | message |
|--------|------|---------|
| 404 | 404 | 帖子不存在 |

---

### 9. 获取随机帖子（推荐页用）

```
GET /api/posts/random
POST /api/posts/random
```

无需登录。从数据库中**较新的 100 条帖子**中随机返回 10 条，适用于首页推荐等场景。

客户端可**上传已获取的帖子 ID**（`excludeIds` 数组，JSON 请求体），服务端会**排除这些帖子**后从剩余帖子中随机返回 10 条，用于分页下拉刷新/加载更多时避免重复推荐。不带 `excludeIds` 时行为不变。

使用建议：Android 端 Retrofit 的 **GET 请求无法携带请求体**，因此请使用 `POST /api/posts/random` 并携带 `excludeIds` 请求体；`GET /api/posts/random` 保留用于无需排除（或通过 `?excludeIds=id1,id2` 查询参数排除）的场景。

**Request Body（可选，`content-type: application/json`，用于 `POST`）：**

```json
{
  "excludeIds": ["5c8b3d1e-9a2f-4c7e-b6d0-1a2b3c4d5e6f", "6d9c4e2f-1b3a-4d8f-a7e0-2b3c4d5e6f7a"]
}
```

**Response `200`：**

- 当返回的帖子数量**达到 10 条**时，`message` 为 `success`
- 当返回的帖子数量**不足 10 条**（数据库帖子里本来就少于 10 条，或排除 `excludeIds` 后剩余不足 10 条）时，`message` 为 `NoMore`，**但仍会在 `data` 中返回剩余的帖子**（可能为空数组 `[]`），客户端可据此停止下拉刷新/加载更多

`data` 为一个**数组（列表）**，最多包含 10 条完整帖子对象（已排除 `excludeIds` 中的帖子），例如：

```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "5c8b3d1e-9a2f-4c7e-b6d0-1a2b3c4d5e6f",
      "title": "今天去了海边",
      "content": "海边的日落真的很好看！",
      "sender": {
        "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        "username": "张三",
        "account": "user123",
        "avatar": "https://i.ibb.co/xxx/avatar.jpg",
        "background": "https://i.ibb.co/xxx/background.jpg",
        "bio": "热爱生活",
        "join_time": "2024-01-01 00:00:00"
      },
      "medias": [
        {
          "id": "f1e2d3c4-b5a6-4c7e-8d9e-0f1a2b3c4d5e",
          "type": "IMAGE",
          "url": "https://i.ibb.co/w04Prt6/c1f64245afb2.jpg"
        },
        {
          "id": "a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d",
          "type": "IMAGE",
          "url": "https://i.ibb.co/98W13PY/c1f64245afb2.jpg"
        }
      ],
      "likes": [
        {
          "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
          "username": "张三",
          "account": "user123",
          "avatar": "https://i.ibb.co/xxx/avatar.jpg"
        }
      ],
      "comments": [
        {
          "id": "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f",
          "content": "拍得真好看！",
          "time": "2024-01-01 00:00:00",
          "type": "POSTCOMMENT",
          "sender": {
            "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
            "username": "李四",
            "account": "user456",
            "avatar": null
          },
          "receiver": null,
        "likes": [
          {
            "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
            "username": "李四",
            "account": "user456",
            "avatar": null
          },
          {
            "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
            "username": "张三",
            "account": "user123",
            "avatar": "https://i.ibb.co/xxx/avatar.jpg"
          }
        ],
          "comments": []
        }
      ],
      "time": "2024-01-01 00:00:00",
      "created_at": "2024-01-01 00:00:00",
      "updated_at": "2024-01-01 00:00:00"
    },
    {
      "id": "6d9c4e2f-1b3a-4d8f-a7e0-2b3c4d5e6f7a",
      "title": "分享一首歌",
      "content": "推荐大家听听这首新歌",
      "sender": {
        "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
        "username": "李四",
        "account": "user456",
        "avatar": null,
        "background": null,
        "bio": null,
        "join_time": "2024-01-02 00:00:00"
      },
      "medias": [],
      "likes": [],
      "comments": [],
      "time": "2024-01-02 00:00:00",
      "created_at": "2024-01-02 00:00:00",
      "updated_at": "2024-01-02 00:00:00"
    }
  ]
}
```

**当数据库帖子不足 10 条或排除 `excludeIds` 后已没有未被选中的帖子时**，`message` 为 `NoMore`，`data` 返回剩余帖子（可能为空数组）：

```json
{
  "code": 200,
  "message": "NoMore",
  "data": []
}
```

说明：

- `data` 是 **JSON 数组**，长度 ≤ 10（数据库中较新帖子不足 10 条时按实际数量返回）
- 请求体 `excludeIds`（数组，`POST` 或 GET 的 `query` 参数）用于排除客户端**已获取**的帖子 ID；匹配到这些 ID 的帖子不会被返回
- Android 端 Retrofit 请用 `POST /api/posts/random` 并在请求体中上传 `excludeIds`
- 每条帖子的结构完全相同，Android 端可解析为 `List<Post>`
- `sender` 为完整的用户信息对象；`medias` 为图片列表（可为空数组）；`likes` 为点赞用户列表（User 对象数组，可为空）；`comments` 为评论列表（可为空数组）

---

### 9.1 搜索帖子

```
GET /api/posts/search
POST /api/posts/search
```

无需登录。客户端上传搜索信息（关键字），服务端在数据库中对帖子的 `title` 和 `content` 做**模糊匹配**（`ILIKE`，不区分大小写），按创建时间倒序返回匹配的帖子列表，并支持分页。

**请求参数（`keyword` 必填，`page` / `pageSize` 可选）：**

客户端可在 `query string`（GET）或 JSON 请求体（POST）中上传，两者取其一即可。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `keyword` | string | 是 | 搜索关键字，匹配帖子的标题或正文 |
| `page` | integer | 否 | 页码，从 1 开始，默认 `1` |
| `pageSize` | integer | 否 | 每页条数，默认 `10`，最大 `50` |

**Request（GET）：**

```
GET /api/posts/search?keyword=海边&page=1&pageSize=10
```

**Request（POST，`content-type: application/json`）：**

```json
{
  "keyword": "海边",
  "page": 1,
  "pageSize": 10
}
```

**Response `200`：** `data` 中 `list` 为匹配到的完整帖子对象数组（结构与 `GET /api/posts` 的元素一致，含 `sender` / `medias` / `likes` / `comments`），`total` 为匹配总条数，供客户端计算总页数。

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [
      {
        "id": "5c8b3d1e-9a2f-4c7e-b6d0-1a2b3c4d5e6f",
        "title": "今天去了海边",
        "content": "海边的日落真的很好看！",
        "sender": {
          "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
          "username": "张三",
          "account": "user123",
          "avatar": null,
          "background": null,
          "bio": null,
          "join_time": "2024-01-01 00:00:00"
        },
        "medias": [],
        "likes": [],
        "comments": [],
        "time": "2024-01-01 00:00:00",
        "created_at": "2024-01-01 00:00:00",
        "updated_at": "2024-01-01 00:00:00"
      }
    ],
    "total": 3,
    "page": 1,
    "pageSize": 10
  }
}
```

说明：

- `keyword` 为空字符串或仅包含空格时，等价于不设关键字，会返回全部帖子（按 `page`/`pageSize` 分页）
- 无匹配结果时，`list` 为空数组 `[]`，`total` 为 `0`
- `page` / `pageSize` 数值非法（小于 1 或非数字）时使用默认值，`pageSize` 超过 `50` 会被限制为 `50`

**错误码：**

| 状态码 | code | message |
|--------|------|---------|
| 500 | 500 | 搜索失败，请稍后重试 |

---

### 10. 获取当前用户的帖子

```
GET /api/posts/my
```

**需要登录**，请求头携带 `Authorization: Bearer <token>`。返回当前登录用户发布的所有帖子，按发布时间倒序排列，结构与 `GET /api/posts/random` 完全相同（`data` 为帖子数组，可能为空数组）。

**Response `200`：**

```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "5c8b3d1e-9a2f-4c7e-b6d0-1a2b3c4d5e6f",
      "title": "今天去了海边",
      "content": "海边的日落真的很好看！",
      "sender": {
        "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        "username": "张三",
        "account": "user123",
        "avatar": "https://i.ibb.co/xxx/avatar.jpg",
        "background": "https://i.ibb.co/xxx/background.jpg",
        "bio": "热爱生活",
        "join_time": "2024-01-01 00:00:00"
      },
      "medias": [],
      "likes": [],
      "comments": [],
      "time": "2024-01-01 00:00:00",
      "created_at": "2024-01-01 00:00:00",
      "updated_at": "2024-01-01 00:00:00"
    }
  ]
}
```

说明：`token` 无效或缺失时返回 `401`。

---

### 10.1 获取我点赞的帖子

```
GET /api/posts/myliked
Authorization: Bearer <token>
```

**需要登录**，请求头携带 `Authorization: Bearer <token>`。返回当前登录用户**点赞过的所有帖子**，按创建时间倒序排列，结构与 `GET /api/posts/my` 完全相同（`data` 为完整帖子对象数组，可能为空数组）。查询依据是帖子 `likes` 字段（JSONB 用户 ID 列表）中是否包含当前用户 ID——即用户在 `POST /api/likes` 点赞过的帖子。**注意：此接口只能查询当前登录用户自己点过赞的帖子，不能传其他 `userId`**。

**Response `200`：**

```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "5c8b3d1e-9a2f-4c7e-b6d0-1a2b3c4d5e6f",
      "title": "今天去了海边",
      "content": "海边的日落真的很好看！",
      "sender": {
        "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        "username": "张三",
        "account": "user123",
        "avatar": "https://i.ibb.co/xxx/avatar.jpg",
        "background": "https://i.ibb.co/xxx/background.jpg",
        "bio": "热爱生活",
        "join_time": "2024-01-01 00:00:00"
      },
      "medias": [],
      "likes": [
        {
          "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
          "account": "user123",
          "username": "张三",
          "avatar": "https://i.ibb.co/xxx/avatar.jpg"
        }
      ],
      "comments": [],
      "time": "2024-01-01 00:00:00",
      "created_at": "2024-01-01 00:00:00",
      "updated_at": "2024-01-01 00:00:00"
    }
  ]
}
```

说明：`token` 无效或缺失时返回 `401`。

---

### 11. 获取用户信息

```
GET /api/users/:id
```

无需登录。根据用户 ID 查询用户基本信息，可用于从帖子 `sender.id` 获取发送者的详细信息。

**Response `200`：**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "uuid",
    "account": "user123",
    "username": "张三",
    "avatar": null,
    "background": null,
    "bio": null,
    "join_time": "2024-01-01 00:00:00"
  }
}
```

**错误码：**

| 状态码 | code | message |
|--------|------|---------|
| 404 | 404 | 用户不存在 |

---

### 12. 更新个人资料

```
PUT /api/users/profile
Authorization: Bearer <token>
Content-Type: application/json
```

需要登录。更新**当前登录用户**的用户名、头像、主页背景图或签名，用户身份以 token 为准（无法修改他人资料）。各字段均可省略，省略的字段保持原值，但至少需要提供一个。

**Request Body（JSON）：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | 否 | 新用户名，不能为空串，最长 100 个字符，首尾空格会被去除 |
| `avatar` | string | 否 | 头像图片 URL（客户端先上传图床获取 URL 后传入） |
| `background` | string | 否 | 主页背景图 URL（客户端先上传图床获取 URL 后传入） |
| `bio` | string | 否 | 个性签名，最长 200 个字符，传空串 `""` 可清空签名 |

```json
{
  "username": "张三",
  "avatar": "https://i.ibb.co/xxx/avatar.jpg",
  "background": "https://i.ibb.co/xxx/background.jpg",
  "bio": "热爱生活，热爱记录"
}
```

**Response `200`：** `data.user` 为更新后的用户信息；`data.token` 为新生成的 Token（有效期重置为 7 天），客户端应使用它替换本地保存的旧 Token。

```json
{
  "code": 200,
  "message": "更新成功",
  "data": {
    "user": {
      "id": "uuid",
      "account": "user123",
      "username": "张三",
      "avatar": "https://i.ibb.co/xxx/avatar.jpg",
      "background": "https://i.ibb.co/xxx/background.jpg",
      "bio": "热爱生活，热爱记录",
      "join_time": "2024-01-01 00:00:00"
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**错误码：**

| 状态码 | code | message |
|--------|------|---------|
| 400 | 400 | 没有需要更新的内容 |
| 400 | 400 | 用户名不能为空 |
| 400 | 400 | 用户名长度不能超过100个字符 |
| 400 | 400 | 签名长度不能超过200个字符 |
| 401 | 401 | 请先登录 / Token无效或已过期 / 用户不存在 |
| 404 | 404 | 用户不存在 |
| 500 | 500 | 更新个人资料失败 |

---

### 13. 发表评论 / 回复

```
POST /api/comments
Authorization: Bearer <token>
Content-Type: application/json
```

需要登录。为指定帖子添加一条评论；`commentType` 为 `REPLYCOMMENT` 时则为对某条评论的**回复（嵌套评论）**，需同时携带 `commentId`（被回复的评论 ID）与 `receiverId`（被回复者用户 ID）。评论结构对应客户端 `data class Comment(id, content, time, type, sender, receiver, likes, comments)`。

**Request Body（JSON）：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `senderId` | string | 是 | 评论者用户 ID（服务端以登录 token 中的用户为准） |
| `commentType` | string | 是 | 评论类型：`POSTCOMMENT`（评论帖子）/ `REPLYCOMMENT`（回复评论） |
| `receiverId` | string | 否 | 被回复者（用户）ID（`commentType` 为 `REPLYCOMMENT` 时必填） |
| `commentId` | string | 否 | 被回复的评论 ID（`commentType` 为 `REPLYCOMMENT` 时必填），必须属于同一帖子 |
| `postId` | string | 是 | 被评论的帖子 ID |
| `content` | string | 是 | 评论内容，不能为空 |

评论帖子示例：

```json
{
  "senderId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  "commentType": "POSTCOMMENT",
  "postId": "5c8b3d1e-9a2f-4c7e-b6d0-1a2b3c4d5e6f",
  "content": "拍得真好看！"
}
```

回复评论示例（`commentType` 为 `REPLYCOMMENT`）：

```json
{
  "senderId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  "commentType": "REPLYCOMMENT",
  "receiverId": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
  "commentId": "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f",
  "postId": "5c8b3d1e-9a2f-4c7e-b6d0-1a2b3c4d5e6f",
  "content": "谢谢～"
}
```

**Response `201`：**

```json
{
  "code": 200,
  "message": "评论成功",
  "data": {
    "id": "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f",
    "content": "拍得真好看！",
    "time": "2024-01-01 00:00:00",
    "type": "POSTCOMMENT",
    "sender": {
      "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
      "username": "李四",
      "account": "user456",
      "avatar": null
    },
    "receiver": null,
    "likes": [],
    "comments": []
  }
}
```

**错误码：**

| 状态码 | code | message |
|--------|------|---------|
| 401 | 401 | 请先登录 / Token无效或已过期 / 用户不存在 |
| 400 | 400 | 评论内容不能为空 |
| 400 | 400 | 帖子ID不能为空 |
| 400 | 400 | 回复的评论ID(commentId)不能为空 |
| 400 | 400 | 被回复者ID(receiverId)不能为空 |
| 400 | 400 | 回复的评论不存在 |
| 400 | 400 | 被回复的用户不存在 |
| 404 | 404 | 帖子不存在 |
| 500 | 500 | 评论失败，请稍后重试 |

**说明：** 评论成功后可调用 `GET /api/posts/:id` 重新拉取帖子详情，其中 `comments` 为按时间正序的**嵌套评论树**——每条评论的 `comments` 字段存放其下所有回复，根评论（`POSTCOMMENT`）无 `parentId`。客户端 `Comment` 模型中的 `type` 对应服务端返回的 `type` 字段：根评论为 `POSTCOMMENT`，回复为 `REPLYCOMMENT`；`receiver` 为被回复者信息（`REPLYCOMMENT` 时返回，根评论为 `null`）；`comments` 缺省为空列表。`senderId` 仅作请求参数，实际评论归属以登录 token 认证的用户为准。

---

### 15. 点赞

```
POST /api/likes
Content-Type: application/json
```

为指定帖子或评论点赞：将请求中的 `userId` 加入目标对象（帖子或评论）的 `likes` 列表（若已存在则保持不变，不会重复点赞），成功后在 `data` 中返回该帖子或评论的**最新数据**（`likes` 为点赞用户对象数组，可为空）。

**Request Body（JSON）：**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userId` | string | 是 | 点赞者用户 ID |
| `type` | string | 是 | 点赞对象类型：`POSTLIKE`（帖子）/ `COMMENTLIKE`（评论），对应客户端 `LikeType` 枚举 |
| `postId` | string | 否 | 点赞对象为帖子时必填，帖子 ID |
| `commentId` | string | 否 | 点赞对象为评论时必填，评论 ID |

点赞帖子示例：

```json
{
  "userId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  "type": "POSTLIKE",
  "postId": "5c8b3d1e-9a2f-4c7e-b6d0-1a2b3c4d5e6f"
}
```

点赞评论示例：

```json
{
  "userId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  "type": "COMMENTLIKE",
  "commentId": "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f"
}
```

**Response `201`（点赞帖子）：** 返回该帖子的最新完整数据，`likes` 已更新为点赞用户对象列表。

```json
{
  "code": 200,
  "message": "点赞成功",
  "data": {
    "id": "5c8b3d1e-9a2f-4c7e-b6d0-1a2b3c4d5e6f",
    "title": "标题",
    "content": "正文",
    "sender": {
      "id": "uuid",
      "username": "用户名",
      "account": "账号",
      "avatar": null,
      "background": null,
      "bio": null,
      "join_time": "2024-01-01 00:00:00"
    },
    "medias": [],
    "likes": [
      {
        "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        "account": "user456",
        "username": "李四",
        "avatar": null,
        "background": null,
        "bio": null,
        "join_time": "2024-01-01 00:00:00"
      }
    ],
    "comments": [],
    "time": "2024-01-01 00:00:00",
    "created_at": "2024-01-01 00:00:00",
    "updated_at": "2024-01-01 00:00:00"
  }
}
```

**Response `201`（点赞评论）：** 返回该评论的最新数据，结构同 `POST /api/comments` 返回的单条评论。

```json
{
  "code": 200,
  "message": "点赞成功",
  "data": {
    "id": "c3d4e5f6-a7b8-4c9d-8e0f-1a2b3c4d5e6f",
    "content": "拍得真好看！",
    "time": "2024-01-01 00:00:00",
    "type": "POSTCOMMENT",
    "sender": {
      "id": "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
      "username": "李四",
      "account": "user456",
      "avatar": null
    },
    "receiver": null,
    "likes": [
      {
        "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        "account": "user456",
        "username": "李四",
        "avatar": null,
        "background": null,
        "bio": null,
        "join_time": "2024-01-01 00:00:00"
      }
    ],
    "comments": []
  }
}
```

**错误码：**

| 状态码 | code | message |
|--------|------|---------|
| 400 | 400 | 点赞对象类型 type 必须为 POSTLIKE 或 COMMENTLIKE |
| 400 | 400 | 帖子ID(postId)不能为空 |
| 400 | 400 | 评论ID(commentId)不能为空 |
| 400 | 400 | 用户ID(userId)不能为空 |
| 404 | 404 | 帖子不存在 |
| 404 | 404 | 评论不存在 |
| 500 | 500 | 点赞失败，请稍后重试 |

---

### 16. 取消点赞

```
POST /api/likes/unlike
Content-Type: application/json
```

取消对指定帖子或评论的点赞：将请求中的 `userId` 从目标对象（帖子或评论）的 `likes` 列表中移除（若用户本就未点赞，则结果不变，不影响其他点赞），成功后在 `data` 中返回该帖子或评论的**最新数据**。

> **说明：** 接口使用 `POST` 携带 JSON 请求体。若客户端使用 Retrofit，需声明为 `@POST("api/likes/unlike")` 并保留 `@Body`——不要用 `@DELETE`（Retrofit 的 `@DELETE` 不支持 `@Body`）。

**Request Body（JSON）：** 与点赞接口相同。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userId` | string | 是 | 取消点赞者用户 ID |
| `type` | string | 是 | 点赞对象类型：`POSTLIKE`（帖子）/ `COMMENTLIKE`（评论），对应客户端 `LikeType` 枚举 |
| `postId` | string | 否 | 点赞对象为帖子时必填，帖子 ID |
| `commentId` | string | 否 | 点赞对象为评论时必填，评论 ID |

取消点赞帖子示例：

```json
{
  "userId": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  "type": "POSTLIKE",
  "postId": "5c8b3d1e-9a2f-4c7e-b6d0-1a2b3c4d5e6f"
}
```

**Response `200`：** 返回该帖子或评论的最新数据（`likes` 已移除该用户），结构与点赞接口 `data` 一致。

```json
{
  "code": 200,
  "message": "取消点赞成功",
  "data": {
    "id": "5c8b3d1e-9a2f-4c7e-b6d0-1a2b3c4d5e6f",
    "title": "标题",
    "content": "正文",
    "sender": {
      "id": "uuid",
      "username": "用户名",
      "account": "账号",
      "avatar": null,
      "background": null,
      "bio": null,
      "join_time": "2024-01-01 00:00:00"
    },
    "medias": [],
    "likes": [],
    "comments": [],
    "time": "2024-01-01 00:00:00",
    "created_at": "2024-01-01 00:00:00",
    "updated_at": "2024-01-01 00:00:00"
  }
}
```

**错误码：**

| 状态码 | code | message |
|--------|------|---------|
| 400 | 400 | 点赞对象类型 type 必须为 POSTLIKE 或 COMMENTLIKE |
| 400 | 400 | 帖子ID(postId)不能为空 |
| 400 | 400 | 评论ID(commentId)不能为空 |
| 400 | 400 | 用户ID(userId)不能为空 |
| 404 | 404 | 帖子不存在 |
| 404 | 404 | 评论不存在 |
| 500 | 500 | 取消点赞失败，请稍后重试 |

## 图片存储说明

当前版本**不存储图片文件**，也不经过任何图床服务。客户端直接将图片的 URL（URI）数组随发布请求一起提交，后端只把这些 URL 原样存入 `post_medias` 表的 `url` 字段。

### Android 端图片发布流程

1. 客户端将选中的图片转换为可访问的 URL（例如自行上传到某个图床后得到 URL，或直接使用已有的图片 URL）
2. 调用 `POST /api/posts` 接口，请求体携带 `images: ["url1", "url2", ...]`
3. 后端将 URL 数组直接保存到数据库
4. 返回的 `medias` 字段中即为保存的图片 URL 列表

## 自动登录流程（前端参考）

1. 用户首次登录，调用 `POST /api/auth/login`，获取 `token` 并保存到本地（如 localStorage）。
2. 每次 App 启动时，从本地取出 `token` 和 `account`，调用 `POST /api/auth/auto_login`（请求体携带 `{ "account": "<account>", "token": "<token>" }`）。
3. 若接口返回 200，表示 token 有效且账号匹配，自动登录成功。
4. 若返回 401，表示 token 无效、过期或账号不匹配，跳转到登录页。

Token 有效期：**7 天**，过期后需重新登录。

## 数据库表结构

```sql
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account    VARCHAR(100) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,
  username   VARCHAR(100),
  avatar     TEXT,
  background TEXT,
  bio        TEXT,
  join_time  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      VARCHAR(255) NOT NULL DEFAULT '',
  content    TEXT NOT NULL DEFAULT '',
  sender_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  likes      JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE post_medias (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  type       VARCHAR(10) NOT NULL DEFAULT 'IMAGE',
  url        TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES comments(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES users(id),
  content     TEXT NOT NULL,
  sender_id   UUID NOT NULL REFERENCES users(id),
  likes       INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
