# 真实密钥联调清单

版本：v1.0  
日期：2026-08-12  
适用范围：AI Excel 本地开发 / 测试环境真实 OAuth 与真实 AI Provider 联调

---

## 1. 联调目标

本轮联调目标：

1. Google 登录可从 `/login` 页面跳转到 Google 授权页，并在授权后回到本地系统。
2. Microsoft 登录可从 `/login` 页面跳转到 Microsoft 授权页，并在授权后回到本地系统。
3. 回调成功后，后端能签发 `access_token` / `refresh_token` Cookie。
4. Assistant、Pivot Builder、Data Analysis、Charts、Reports 能通过真实 AI Provider 返回结果。

---

## 2. 当前代码口径

后端当前使用的 OAuth 回调地址由 `FRONTEND_ORIGIN` 推导：

- Google 回调地址：`{FRONTEND_ORIGIN}/api/auth/google/callback`
- Microsoft 回调地址：`{FRONTEND_ORIGIN}/api/auth/microsoft/callback`

本地默认值：

- `FRONTEND_ORIGIN=http://127.0.0.1:3001`

因此，本地联调时应在第三方平台配置的精确回调地址是：

- Google：`http://127.0.0.1:3001/api/auth/google/callback`
- Microsoft：`http://127.0.0.1:3001/api/auth/microsoft/callback`

说明：

- 前端通过 Next.js rewrite 将 `/api/*` 代理到后端 `http://127.0.0.1:3000`。
- 这样做的原因是 Cookie 会落在前端域名 `127.0.0.1:3001` 下，浏览器后续访问前端时可以自然带上。

---

## 3. backend/.env 必填项

真实联调前，需要至少填写以下变量：

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@192.168.188.131:5431/aiexcel
JWT_SECRET=change-me
CORS_ORIGINS=http://127.0.0.1:3001
FRONTEND_ORIGIN=http://127.0.0.1:3001

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

AI_PROVIDER_API_KEY=
AI_PROVIDER_BASE_URL=https://api.apimart.ai/v1
AI_PROVIDER_ENABLE_INPUT_FILE=false
AI_MODEL_DEFAULT=gpt-5.6-terra
AI_MODEL_COMPLEX=gpt-5.6-sol
AI_MODEL_FAST=gpt-5.6-luna
```

建议：

- `CORS_ORIGINS` 从 `http://localhost:3001` 改成 `http://127.0.0.1:3001`
- `FRONTEND_ORIGIN` 明确设置为 `http://127.0.0.1:3001`

原因：

- 当前前端默认代理和本地联调都是以 `127.0.0.1` 为主。
- 若一边用 `localhost`，一边用 `127.0.0.1`，浏览器 Cookie 与跨域行为可能不一致。

---

## 4. Google OAuth 配置清单

Google Cloud Console 中建议配置：

1. 创建或选择项目。
2. 启用 Google Identity / OAuth 相关能力。
3. 创建 OAuth Client，应用类型选择 Web application。
4. Authorized redirect URI 填入：

```text
http://127.0.0.1:3001/api/auth/google/callback
```

5. 将生成的 `Client ID`、`Client Secret` 填入：

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

建议补充：

- Authorized JavaScript origins 可加：

```text
http://127.0.0.1:3001
```

---

## 5. Microsoft OAuth 配置清单

Azure Portal / Microsoft Entra 管理中心建议配置：

1. 创建或选择 App registration。
2. 平台选择 Web。
3. Redirect URI 填入：

```text
http://127.0.0.1:3001/api/auth/microsoft/callback
```

4. 记录 `Application (client) ID`。
5. 创建 Client Secret。
6. 将其填入：

```env
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
```

建议权限：

- `openid`
- `profile`
- `email`
- `User.Read`

当前代码会请求上述范围。

---

## 6. AI Provider 配置清单

### 6.1 通过 apimart.ai 调 OpenAI 兼容 Responses

填写：

```env
AI_PROVIDER_BASE_URL=https://api.apimart.ai/v1
AI_PROVIDER_API_KEY=你的 apimart key
AI_PROVIDER_ENABLE_INPUT_FILE=false
AI_MODEL_DEFAULT=gpt-5.6-terra
AI_MODEL_COMPLEX=gpt-5.6-sol
AI_MODEL_FAST=gpt-5.6-luna
```

说明：
- 当前后端已兼容 `POST /v1/responses`
- 默认优先发送我们自己解析后的表格摘要，不直接上传原始 Excel 文件
- 若后续确认网关兼容 `input_file`，可再把 `AI_PROVIDER_ENABLE_INPUT_FILE=true`

### 6.2 直连 OpenAI

填写：

```env
AI_PROVIDER_BASE_URL=https://api.openai.com/v1
AI_PROVIDER_API_KEY=sk-...
AI_PROVIDER_ENABLE_INPUT_FILE=true
AI_MODEL_DEFAULT=gpt-5.6-terra
AI_MODEL_COMPLEX=gpt-5.6-sol
AI_MODEL_FAST=gpt-5.6-luna
```

### 6.3 通过其他 OpenAI 兼容中转

如果使用 OpenAI 兼容中转，例如你前面验证过的兼容网关，则填写：

```env
AI_PROVIDER_BASE_URL=https://你的网关域名/v1
AI_PROVIDER_API_KEY=你的网关密钥
AI_PROVIDER_ENABLE_INPUT_FILE=false
AI_MODEL_DEFAULT=gpt-5.6-terra
AI_MODEL_COMPLEX=gpt-5.6-sol
AI_MODEL_FAST=gpt-5.6-luna
```

前提：

- 该网关必须兼容 `POST /v1/responses`
- 兼容 `input_text`
- 最好兼容 `input_file`

---

## 7. 启动顺序

### 7.1 后端

```powershell
npm.cmd run dev:backend
```

### 7.2 前端

```powershell
npm.cmd run dev:frontend
```

启动后检查：

- 后端健康检查：`http://127.0.0.1:3000/api/health`
- 前端登录页：`http://127.0.0.1:3001/login`

---

## 8. 真登录联调步骤

### 8.1 Google

1. 打开 `http://127.0.0.1:3001/login`
2. 点击 `Continue with Google`
3. 浏览器应跳转到 Google 授权页
4. 授权后应回到：

```text
http://127.0.0.1:3001/dashboard
```

5. 验证接口：

```text
GET http://127.0.0.1:3001/api/auth/me
```

预期：

- 返回 `success: true`
- `data.user.email` 为真实 Google 邮箱

### 8.2 Microsoft

1. 打开 `http://127.0.0.1:3001/login`
2. 点击 `Continue with Microsoft`
3. 浏览器应跳转到 Microsoft 授权页
4. 授权后应回到：

```text
http://127.0.0.1:3001/dashboard
```

5. 验证接口：

```text
GET http://127.0.0.1:3001/api/auth/me
```

预期：

- 返回 `success: true`
- `data.user.email` 为真实 Microsoft 邮箱

---

## 9. 真模型联调步骤

### 9.1 Assistant

1. 登录后上传一个 `.xlsx` 或 `.csv`
2. 进入 Assistant 页面
3. 发送一句测试问题，例如：

```text
Summarize this workbook and tell me the main columns.
```

预期：

- SSE 流式接口返回 `message.delta`
- 最终返回 `message.complete`
- 数据库 `ai_requests` 中有一条 `tool_type=assistant` 的真实记录

### 9.2 Pivot Builder

测试语句：

```text
Build a pivot grouped by Region and Month with Revenue as sum.
```

预期：

- 任务创建成功
- 详情接口返回 `completed`
- `result.rows / result.columns / result.values` 有真实内容

### 9.3 Data Analysis

测试语句：

```text
Analyze revenue trends and identify anomalies.
```

预期：

- 返回 `summaryMd`
- 返回 `insights`
- `ai_requests` 中有 `tool_type=data_analysis`

### 9.4 Charts

测试语句：

```text
Create the most suitable chart for revenue trend over time.
```

预期：

- 返回 `chartType`
- 返回 `config`

### 9.5 Reports

测试语句：

```text
Generate an executive summary report for this workbook.
```

预期：

- 返回 `contentMd`
- 可在前端展示 Markdown 报告

---

## 10. 推荐的最小验收顺序

建议按下面顺序做，最省排查成本：

1. 填 `backend/.env`
2. 重启后端
3. 真跑 Google 登录
4. 用已登录态跑 `/api/auth/me`
5. 上传一个最小 CSV
6. 跑 Assistant
7. 跑 Data Analysis
8. 再跑 Pivot / Charts / Reports

---

## 11. 当前阻塞项

截至 2026-08-12，这一轮“真联调”还缺以下前置条件：

1. `backend/.env` 中真实密钥仍为空
2. 第三方平台上的回调地址尚未确认已按本地 `127.0.0.1:3001` 口径配置
3. AI Provider 的真实 API Key 尚未填入

因此，目前代码已具备真实联调能力，但尚不具备立即完成真登录 / 真模型请求的配置条件。

---

## 12. 联调结论

当前状态可以分为两层：

### 12.1 已完成

- 真实 OAuth 代码路径已接入
- 真实 AI Provider 代码路径已接入
- 未配密钥时可自动降级到 demo 模式
- 前后端构建已通过

### 12.2 仍需你提供

- Google Client ID / Secret
- Microsoft Client ID / Secret
- AI Provider API Key
- 若使用中转，则还需要 `AI_PROVIDER_BASE_URL`

当以上信息补齐后，即可进入真正的浏览器授权联调与真实模型调用联调。
