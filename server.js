// server.js
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(🚀 认证服务已启动);
  console.log(📍 http://localhost:);
  console.log(📝 健康检查: http://localhost:/health);
});
