# AIExcel Docker 部署说明

## 1. 端口规划

为避开服务器上其他项目已经占用的 `3000` 和 `3001`，本项目默认使用：

- 前端宿主机端口：`3101`
- 后端宿主机端口：`3100`
- Java Pivot 导出服务容器内端口：`8085`

说明：

- 浏览器访问前端：`http://服务器IP:3101`
- 如需直接调试后端：`http://服务器IP:3100/api/health`
- 前端容器内部通过 `http://backend:3000` 访问后端
- 后端容器内部通过 `http://pivot-export:8085` 访问 Java Pivot 服务

## 2. 服务器目录准备

假设项目部署目录为 `/data/www/AIExcel`：

```bash
mkdir -p /data/www/AIExcel
cd /data/www/AIExcel
```

将本地仓库代码上传到该目录。

## 3. 后端环境变量

复制一份后端环境变量：

```bash
cd /data/www/AIExcel
cp backend/.env.example backend/.env
```

至少需要修改这些值：

- `NODE_ENV=production`
- `PORT=3000`
- `DATABASE_URL=你的 PostgreSQL 连接串`
- `JWT_SECRET=请替换为强随机字符串`
- `FRONTEND_ORIGIN=http://服务器IP:3101`
- `CORS_ORIGINS=http://服务器IP:3101`
- `OUTBOUND_PROXY_MODE=off`
- `STRIPE_SECRET_KEY=你的 Stripe Key`
- `STRIPE_WEBHOOK_SECRET=你的 Stripe Webhook Secret`
- `AI_PROVIDER_API_KEY=你的 AI Provider Key`
- `AI_PROVIDER_BASE_URL=https://api.apimart.ai/v1`
- `AI_MODEL_DEFAULT=gpt-5.6-terra`
- `AI_MODEL_COMPLEX=gpt-5.6-sol`
- `AI_MODEL_FAST=gpt-5.6-luna`
- `PIVOT_EXPORT_MODE=java_native`
- `PIVOT_EXPORT_SERVICE_URL=http://pivot-export:8085`
- `PIVOT_EXPORT_SHARED_TOKEN=请替换为随机字符串`
- `GOOGLE_CLIENT_ID=你的 Google Client ID`
- `GOOGLE_CLIENT_SECRET=你的 Google Client Secret`
- `MICROSOFT_CLIENT_ID=你的 Microsoft Client ID`
- `MICROSOFT_CLIENT_SECRET=你的 Microsoft Client Secret`

## 4. Docker 启动

首次构建并启动：

```bash
cd /data/www/AIExcel
docker compose -f docker-compose.prod.yml up -d --build
```

查看运行状态：

```bash
docker compose -f docker-compose.prod.yml ps
```

查看日志：

```bash
docker compose -f docker-compose.prod.yml logs -f frontend
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f pivot-export
```

停止服务：

```bash
docker compose -f docker-compose.prod.yml down
```

## 5. 对外访问

- 前端：`http://服务器IP:3101/login`
- 后端健康检查：`http://服务器IP:3100/api/health`

## 6. OAuth 与 Stripe 回调配置

如果你直接用端口对外访问：

- Google 回调地址：`http://服务器IP:3101/api/auth/google/callback`
- Microsoft 回调地址：`http://服务器IP:3101/api/auth/microsoft/callback`
- Stripe Webhook 地址：`http://服务器IP:3100/api/billing/webhook`

如果后面接 Nginx 域名，例如 `https://excel.example.com`，则统一改成：

- Google 回调地址：`https://excel.example.com/api/auth/google/callback`
- Microsoft 回调地址：`https://excel.example.com/api/auth/microsoft/callback`
- Stripe Webhook 地址：`https://excel.example.com/api/billing/webhook`

同时把 `backend/.env` 中这两个值改成：

- `FRONTEND_ORIGIN=https://excel.example.com`
- `CORS_ORIGINS=https://excel.example.com`

## 7. 更新部署

代码更新后重新构建：

```bash
cd /data/www/AIExcel
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```
