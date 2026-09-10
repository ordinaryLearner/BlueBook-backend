// src/utils/putput.js
const axios = require('axios');

const BASE_URL = 'https://putput.io/api/v1';

// 访客 token 有效期 30 天；本地缓存提前 1 天失效，避免边界上用到过期 token
const TOKEN_TTL_MS = 29 * 24 * 60 * 60 * 1000;

// 模块级缓存：多个请求共用一个 token（PutPut 明确要求不要每个请求都新建 token）
let cachedToken = null;
let cachedTokenAt = 0;

const authHeaders = (token) => ({ Authorization: `Bearer ${token}` });

// 从上游错误响应里提取 {"error":{"code","message"}} 结构
const extractErrorCode = (error) => {
  const data = error && error.response && error.response.data;
  if (data && data.error && data.error.code) return data.error.code;
  return null;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 获取 PutPut 访客 token。优先使用环境变量 PUTPUT_TOKEN，否则调用 /auth/guest 并缓存。
 * @returns {Promise<{token: string, error: string|null}>}
 */
const getGuestToken = async (force = false) => {
  if (!force && process.env.PUTPUT_TOKEN) return { token: process.env.PUTPUT_TOKEN, error: null };

  if (!force && cachedToken && Date.now() - cachedTokenAt < TOKEN_TTL_MS) {
    return { token: cachedToken, error: null };
  }

  try {
    // 必须显式带 Content-Type: application/json，否则上游按表单提交拦截返回 403
    const { status, data } = await axios.post(`${BASE_URL}/auth/guest`, null, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
      validateStatus: () => true
    });

    if (status < 200 || status >= 300 || !data || !data.token) {
      const desc = `HTTP ${status} ${typeof data === 'string' ? data : JSON.stringify(data)}`.slice(0, 300);
      console.error('获取 PutPut token 失败:', desc);
      return { token: null, error: desc };
    }

    cachedToken = data.token;
    cachedTokenAt = Date.now();
    return { token: cachedToken, error: null };
  } catch (error) {
    console.error('获取 PutPut token 异常:', error.message);
    return { token: null, error: error.message };
  }
};

/**
 * 把内存中的文件上传到 PutPut，返回可直接访问的 CDN 地址。
 * 流程：presign 拿预签名 URL -> PUT 原始字节 -> confirm 拿 public_url。
 * @param {Buffer} buffer 文件内容
 * @param {{filename: string, contentType: string}} meta 文件名与 MIME 类型
 * @returns {Promise<{url: string, fileId: string|null, error: string|null}>}
 */
const uploadBuffer = async (buffer, { filename, contentType }) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { url: null, fileId: null, error: '文件内容为空' };
  }

  const attempt = async (token) => {
    // 1) 预签名
    const presignRes = await axios.post(
      `${BASE_URL}/upload/presign`,
      { filename, content_type: contentType, size_bytes: buffer.length },
      { headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, timeout: 30000, validateStatus: () => true }
    );

    if (presignRes.status < 200 || presignRes.status >= 300) {
      const code = extractErrorCode(presignRes);
      const message = presignRes.data && presignRes.data.error && presignRes.data.error.message;
      return { error: code || `presign HTTP ${presignRes.status}`, message, status: presignRes.status };
    }

    const { upload_id: uploadId, presigned_url: presignedUrl } = presignRes.data || {};
    if (!uploadId || !presignedUrl) {
      return { error: 'presign 响应缺少 upload_id / presigned_url', status: 500 };
    }

    // 2) PUT 直传 R2：不能带 Authorization，Content-Type 必须与 presign 一致
    // transformRequest 禁止 axios 重新序列化 body，保证发送字节与 buffer 完全一致
    const putRes = await axios.put(presignedUrl, buffer, {
      headers: { 'Content-Type': contentType },
      timeout: 120000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      transformRequest: [(d) => d],
      validateStatus: () => true
    });

    if (putRes.status < 200 || putRes.status >= 300) {
      return { error: `上传到存储失败 HTTP ${putRes.status}`, status: putRes.status };
    }

    // 3) 确认，拿到 CDN 地址
    const confirmRes = await axios.post(
      `${BASE_URL}/upload/confirm`,
      { upload_id: uploadId },
      { headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, timeout: 30000, validateStatus: () => true }
    );

    if (confirmRes.status < 200 || confirmRes.status >= 300) {
      const code = extractErrorCode(confirmRes);
      const message = confirmRes.data && confirmRes.data.error && confirmRes.data.error.message;
      return { error: code || `confirm HTTP ${confirmRes.status}`, message, status: confirmRes.status };
    }

    const file = (confirmRes.data && confirmRes.data.file) || {};
    if (!file.public_url) {
      return { error: 'confirm 响应缺少 public_url', status: 500 };
    }

    return { url: file.public_url, fileId: file.id || null };
  };

  const { token, error: tokenError } = await getGuestToken();
  if (!token) return { url: null, fileId: null, error: tokenError };

  try {
    let result = await attempt(token);

    // token 失效时清缓存重试一次
    if (result.error === 'UNAUTHORIZED') {
      const refreshed = await getGuestToken(true);
      if (refreshed.token) result = await attempt(refreshed.token);
    }

    if (result.error) {
      const desc = [result.error, result.message].filter(Boolean).join(': ');
      console.error('PutPut 上传失败:', desc);
      return { url: null, fileId: null, error: desc };
    }

    return { url: result.url, fileId: result.fileId, error: null };
  } catch (error) {
    console.error('PutPut 上传异常:', error.message);
    return { url: null, fileId: null, error: error.message };
  }
};

/**
 * 删除已上传的文件，用于建帖失败后的尽力回滚。
 * @param {string} fileId confirm 返回的 file.id
 * @returns {Promise<{ok: boolean, error: string|null}>}
 */
const deleteFile = async (fileId) => {
  if (!fileId) return { ok: false, error: '缺少 fileId' };
  const { token, error: tokenError } = await getGuestToken();
  if (!token) return { ok: false, error: tokenError };

  try {
    const res = await axios.delete(`${BASE_URL}/files/${fileId}`, {
      headers: authHeaders(token),
      timeout: 30000,
      validateStatus: () => true
    });
    if (res.status < 200 || res.status >= 300) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

module.exports = { getGuestToken, uploadBuffer, deleteFile, sleep };
