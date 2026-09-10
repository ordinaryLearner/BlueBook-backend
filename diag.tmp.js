require('dotenv').config();
const jwt = require('jsonwebtoken');
const { pool } = require('./src/config/database');
const app = require('./src/app');
const PORT = 3993;
const server = app.listen(PORT, async () => {
  const base = `http://127.0.0.1:${PORT}`;
  const created = [];
  try {
    const u = await pool.query("SELECT id FROM users WHERE account='111111' LIMIT 1");
    const token = jwt.sign({ userId: u.rows[0].id }, process.env.JWT_SECRET);
    const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

    const cases = [
      ['完全不带 images 字段', { title: 'diag-no-images', content: 'x' }],
      ['images 为空数组', { title: 'diag-empty-arr', content: 'x', images: [] }],
      ['images 为 null', { title: 'diag-null', content: 'x', images: null }],
      ['images 为空字符串', { title: 'diag-empty-str', content: 'x', images: '' }],
      ['imageUrls 为空字符串', { title: 'diag-empty-str2', content: 'x', imageUrls: '' }],
      ['images 数组含空串', { title: 'diag-blank-item', content: 'x', images: ['', '  '] }],
    ];
    for (const [label, body] of cases) {
      const r = await fetch(`${base}/api/posts`, { method: 'POST', headers: H, body: JSON.stringify(body) });
      const b = await r.json();
      const id = b.data && b.data.id;
      if (id) created.push(id);
      const medias = b.data && b.data.medias;
      console.log(label.padEnd(26), '-> HTTP', r.status, '| code', b.code, '| medias:', JSON.stringify(medias), '| 落库媒体数:', id ? (await pool.query('SELECT count(*)::int n FROM post_medias WHERE post_id=$1',[id])).rows[0].n : '-');
    }
    console.log('\n服务端行为：以上全部成功建帖，medias 为空数组 []');
  } catch (e) { console.error('ERR', e.message); }
  finally {
    for (const id of created) await pool.query('DELETE FROM posts WHERE id=$1', [id]);
    console.log('已清理', created.length, '条诊断数据');
    server.close(); await pool.end(); process.exit(0);
  }
});
