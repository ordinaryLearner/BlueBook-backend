// server.js
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[Server] 认证服务已启动`);
  console.log(`[Server] 地址: http://localhost:${PORT}`);
  console.log(`[Server] 健康检查: http://localhost:${PORT}/health`);
});