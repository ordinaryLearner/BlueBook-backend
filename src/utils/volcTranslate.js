// src/utils/volcTranslate.js
const crypto = require('crypto');
const axios = require('axios');

const HOST = 'open.volcengineapi.com';
const REGION = 'cn-north-1';
const SERVICE = 'translate';
const VERSION = '2020-06-01';
const ACTION = 'TranslateText';
const CANONICAL_QUERY = `Action=${ACTION}&Version=${VERSION}`;
const JSON_CONTENT_TYPE = 'application/json';

const sha256Hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const hmacHex = (key, data) => crypto.createHmac('sha256', key).update(data).digest('hex');

// 签名密钥链：SecretAccessKey -> dateStamp -> region -> service -> "request"
// 注意：火山引擎官方签名器 kDatePrefix 为空串，第一步不加任何前缀（不要加 "VOLC"）；
// SecretAccessKey 也直接原样使用，不做 base64 等解码。
const signatureKey = (secretKey, dateStamp) =>
  hmac(hmac(hmac(hmac(Buffer.from(secretKey, 'utf8'), dateStamp), REGION), SERVICE), 'request');

// ISO8601 UTC，形如 20260910T073448Z
const iso8601 = (date) =>
  date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[:\-]|\.\d{3}/g, '');

/**
 * 调用火山引擎机器翻译。
 * @param {string} text 待翻译文本
 * @param {string} target 目标语言，默认 zh
 * @param {string|null} source 源语言；传 null 表示自动识别（接口不接受字面量 "auto"，需省略该字段）
 * @returns {Promise<{translation: string, error: string|null}>} 成功时 translation 为译文、error 为 null；失败时 translation 为空串并给出 error 描述
 */
const translate = async (text, target = 'zh', source = null) => {
  const accessKey = process.env.VOLC_ACCESS_KEY;
  const secretKey = process.env.VOLC_SECRET_KEY;
  if (!accessKey || !secretKey) {
    return { translation: '', error: '未配置 VOLC_ACCESS_KEY / VOLC_SECRET_KEY' };
  }

  const payload = { TargetLanguage: target, TextList: [text] };
  // 省略 SourceLanguage 即由服务端自动识别；传 "auto" 会被上游拒绝
  if (source) payload.SourceLanguage = source;
  const bodyJson = JSON.stringify(payload);

  const amzDate = iso8601(new Date());
  const dateStamp = amzDate.substring(0, 8);
  const payloadHash = sha256Hex(bodyJson);

  // 参与签名的头只有 host / x-content-sha256 / x-date，content-type 不参与签名
  const signedHeaders = 'host;x-content-sha256;x-date';
  const canonicalHeaders =
    `host:${HOST}\n` +
    `x-content-sha256:${payloadHash}\n` +
    `x-date:${amzDate}\n`;
  // 规范化头块后需要多出一个空行（headers 与 signedHeaders 之间是两个 \n），少一个换行会 SignatureDoesNotMatch

  const canonicalRequest = [
    'POST',
    '/',
    CANONICAL_QUERY,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/request`;
  const stringToSign = [
    'HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n');

  const signature = hmacHex(signatureKey(secretKey, dateStamp), stringToSign);
  const authorization =
    `HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  try {
    const { status, data } = await axios.post(
      `https://${HOST}/?${CANONICAL_QUERY}`,
      bodyJson,
      {
        headers: {
          Host: HOST,
          'Content-Type': JSON_CONTENT_TYPE,
          'X-Date': amzDate,
          'X-Content-Sha256': payloadHash,
          Authorization: authorization
        },
        // 参与签名的 body 必须与实际发送的字节完全一致，禁止 axios 重新序列化
        transformRequest: [(d) => d],
        validateStatus: () => true,
        timeout: 15000
      }
    );

    // 火山引擎失败时 HTTP 状态码也可能是 200，错误藏在 ResponseMetadata.Error 中，必须显式判断
    const upstreamError = data && data.ResponseMetadata && data.ResponseMetadata.Error;
    if (upstreamError) {
      const desc = `${upstreamError.Code}(CodeN:${upstreamError.CodeN || '-'}) ${upstreamError.Message || ''}`.trim();
      console.error(`翻译失败: HTTP ${status} ${desc}`);
      return { translation: '', error: desc };
    }

    if (status < 200 || status >= 300) {
      const desc = `HTTP ${status} ${typeof data === 'string' ? data : JSON.stringify(data)}`.slice(0, 500);
      console.error('翻译失败:', desc);
      return { translation: '', error: desc };
    }

    const list = (data && data.TranslationList) || [];
    if (list.length === 0 || !list[0].Translation) {
      console.error('翻译失败: 响应中无 TranslationList', JSON.stringify(data).slice(0, 300));
      return { translation: '', error: '响应中无翻译结果' };
    }

    return { translation: list[0].Translation, error: null };
  } catch (error) {
    console.error('翻译请求异常:', error.message);
    return { translation: '', error: error.message };
  }
};

module.exports = { translate };
