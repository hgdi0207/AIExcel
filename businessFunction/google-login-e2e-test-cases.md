# AI Excel Google 账号全链路测试用例

版本：v1.1  
日期：2026-08-12  
适用范围：使用 Google 账号完成本地环境下的整项目功能测试，并覆盖当前 MVP 的 5 个核心任务：`Pivot Builder`、`Spreadsheet Assistant`、`Data Analysis`、`Charts & Graphs`、`Reports`

---

## 1. 测试目标

- 验证 Google OAuth 登录可正常完成授权、回调、会话恢复和退出。
- 验证 MVP 核心链路可在真实 Google 账号下完整跑通。
- 验证文件上传、Spreadsheet Assistant、Pivot Builder、Data Analysis、Charts、Reports、Billing、Usage 的端到端行为。
- 验证通过 `apimart.ai` 中转的 OpenAI 兼容 `Responses API` 已可返回真实结果。

---

## 2. 测试前置条件

### 2.1 环境条件

- 后端可正常启动。
- 前端可正常启动。
- PostgreSQL 可连接。
- Google OAuth 已完成配置。
- 如需验证真实 AI 结果，`AI_PROVIDER_API_KEY` 已配置。
- 如需走代理访问外网，后端代理模式已启用。

### 2.2 推荐环境变量

```env
NODE_ENV=development
FRONTEND_ORIGIN=http://127.0.0.1:3001
CORS_ORIGINS=http://127.0.0.1:3001
OUTBOUND_PROXY_MODE=development
OUTBOUND_PROXY_URL=http://127.0.0.1:7890
OUTBOUND_NO_PROXY=127.0.0.1,localhost

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

AI_PROVIDER_API_KEY=...
AI_PROVIDER_BASE_URL=https://api.apimart.ai/v1
AI_PROVIDER_ENABLE_INPUT_FILE=false
AI_MODEL_DEFAULT=gpt-5.6-terra
AI_MODEL_COMPLEX=gpt-5.6-sol
AI_MODEL_FAST=gpt-5.6-luna
```

### 2.3 启动命令

后端：

```powershell
npm.cmd run dev:backend
```

前端：

```powershell
npm.cmd run dev:frontend
```

### 2.4 推荐测试文件

建议准备 3 份测试文件：

1. `sales-small.csv`
内容：
- 字段：`Region, Month, Revenue, Cost, Profit`
- 10 到 20 行样例数据

2. `sales-multi-sheet.xlsx`
内容：
- Sheet1：销售明细
- Sheet2：区域汇总
- Sheet3：月度目标

3. `bad-format.txt`
内容：
- 任意文本
- 用于验证非法文件上传

### 2.5 当前实现口径说明

- Google 登录成功后会回跳到 `http://127.0.0.1:3001/dashboard`。
- Spreadsheet Assistant 使用 SSE 接口：`POST /api/assistant/threads/:id/messages/stream`。
- Assistant 当前虽然走 SSE，但后端通常会一次性返回完整回答，再发送 `message.complete`，测试时不强制要求逐字输出效果。
- Pivot Builder、Data Analysis、Charts、Reports 当前采用“创建任务后由前端轮询业务详情接口”的方式取结果，不要求测试人员直接操作 `/api/jobs/*`。
- Billing 页面支持真实 Stripe Checkout 和 Billing Portal，本轮可按真实支付链路验证。
- 当前前端没有可点击的 `Sign Out` 按钮，退出登录通过接口验证。

---

## 3. 测试通过标准

- 无阻塞性 500 错误。
- 所有主功能页面可访问。
- 所有核心任务可创建并返回结果。
- 登录态可在页面刷新后保留。
- 退出后受保护接口不可继续访问。
- Usage 有记录。
- Billing 页面可正常展示摘要信息。

---

## 4. 测试用例清单

## 4.1 启动与健康检查

### TC-001 后端启动成功

前置条件：
- 已执行 `npm.cmd run dev:backend`

步骤：
1. 访问 `http://127.0.0.1:3000/api/health`

预期结果：
- 返回 `200`
- 返回体包含 `{"success":true,"data":{"status":"ok"}}`

### TC-002 前端启动成功

前置条件：
- 已执行 `npm.cmd run dev:frontend`

步骤：
1. 访问 `http://127.0.0.1:3001/login`

预期结果：
- 页面正常打开
- 可看到 `Continue with Google`
- 可看到 `Continue with Microsoft`

## 4.2 Google 登录

### TC-003 Google 登录成功

前置条件：
- Google OAuth 已正确配置
- 后端可访问 Google

步骤：
1. 打开登录页
2. 点击 `Continue with Google`
3. 在 Google 授权页完成授权

预期结果：
- 成功跳回 `http://127.0.0.1:3001/dashboard`
- 浏览器已建立登录态
- 页面不再停留在 `/login`

### TC-004 获取当前用户信息

前置条件：
- 已完成 Google 登录

步骤：
1. 打开 `http://127.0.0.1:3001/api/auth/me`

预期结果：
- 返回 `200`
- `data.user.email` 为实际 Google 邮箱
- `data.user.name` 为 Google 用户昵称或展示名

### TC-005 刷新页面后会话保持

前置条件：
- 已完成 Google 登录

步骤：
1. 在 Dashboard 页面刷新浏览器
2. 再进入 `/assistant`
3. 再进入 `/usage`

预期结果：
- 页面继续处于已登录状态
- 不会因为刷新立即丢失会话

### TC-006 退出登录成功

前置条件：
- 已完成 Google 登录

步骤：
1. 调用 `POST http://127.0.0.1:3001/api/auth/logout`
2. 再访问 `http://127.0.0.1:3001/api/auth/me`
3. 再访问 `/dashboard`

预期结果：
- 退出接口返回成功
- `/api/auth/me` 返回未授权
- `/dashboard` 不再具备正常登录态数据

## 4.3 Dashboard

### TC-007 Dashboard 展示正常

前置条件：
- 已登录

步骤：
1. 进入 `/dashboard`

预期结果：
- 可看到 5 个核心工具入口卡片
- 可看到 Credits 摘要
- 可看到 Workbooks 摘要
- 可看到 `Recent workbooks` 区域
- 可通过侧边导航访问 `Billing` 和 `Usage History`

### TC-008 Dashboard 链接跳转正常

前置条件：
- 已登录

步骤：
1. 依次点击 `Spreadsheet Assistant`
2. 点击 `Pivot Builder`
3. 点击 `Data Analysis`
4. 点击 `Charts & Graphs`
5. 点击 `Reports`

预期结果：
- 均可跳转到对应页面
- 无白屏或 404

## 4.4 文件上传

### TC-009 上传 CSV 成功

前置条件：
- 已登录
- 已准备 `sales-small.csv`

步骤：
1. 在任一支持 Workbook 选择的页面上传 `sales-small.csv`

预期结果：
- 上传成功
- 文件出现在 Workbook 列表中
- 状态为 `ready`
- 上传本身不应消耗积分

### TC-010 上传多 Sheet Excel 成功

前置条件：
- 已登录
- 已准备 `sales-multi-sheet.xlsx`

步骤：
1. 上传该文件

预期结果：
- 上传成功
- `sheetCount` 大于 1
- 预览中可看到多个 Sheet

### TC-011 上传非法格式失败

前置条件：
- 已登录
- 已准备 `bad-format.txt`

步骤：
1. 上传 `bad-format.txt`

预期结果：
- 返回失败提示
- 不写入可用 Workbook 记录

### TC-012 Workbook 预览展示正常

前置条件：
- 已上传有效文件

步骤：
1. 选择一个已上传的 Workbook

预期结果：
- 可看到 Sheet 名称
- 可看到表头
- 可看到 sample rows

## 4.5 Spreadsheet Assistant

### TC-013 创建新会话成功

前置条件：
- 已登录
- 至少已有 1 个 Workbook

步骤：
1. 进入 `/assistant`
2. 选择一个 Workbook
3. 点击 `New chat` 或直接发送第一条消息

预期结果：
- 会话创建成功
- 会话出现在左侧历史列表

### TC-014 Assistant 流式回复成功

前置条件：
- 已创建会话
- 已绑定 Workbook

步骤：
1. 输入问题：`Summarize this workbook and tell me the key columns.`
2. 发送消息

预期结果：
- 前端通过 SSE 成功收到回复
- 页面出现 AI 回复内容
- 允许当前实现表现为“整段回答一次性出现”
- 最终回复完整，无卡死
- Assistant 完成后应记录 1 次积分消耗

### TC-015 Assistant 刷新后历史消息保留

前置条件：
- 已完成至少 1 轮问答

步骤：
1. 刷新 `/assistant`
2. 重新打开刚才的会话

预期结果：
- 历史消息仍可见
- 顺序正确

## 4.6 Pivot Builder

### TC-016 Pivot 任务创建成功

前置条件：
- 已登录
- 已上传 `sales-small.csv`

步骤：
1. 进入 `/pivot-builder`
2. 选择 Workbook
3. 输入：`Build a pivot grouped by Region and Month with Revenue as sum.`
4. 提交

预期结果：
- 创建成功
- 页面进入运行中状态
- 最终状态变为 `completed`
- 结果区出现 `Download xlsx` 按钮
- 生成可下载的 pivot 文件，例如 `sales-small-pivot.xlsx`

### TC-017 Pivot 结果结构正确

前置条件：
- 已完成 TC-016

步骤：
1. 查看任务结果
2. 点击下载按钮

预期结果：
- 下载成功
- 文件可打开
- pivot 表内容与输入表格相匹配

## 4.7 Data Analysis

### TC-018 Data Analysis 任务创建成功

前置条件：
- 已登录
- 已上传 `sales-multi-sheet.xlsx`

步骤：
1. 进入 `/data-analysis`
2. 选择 Workbook
3. 输入：`Analyze revenue trends and identify anomalies.`
4. 提交

预期结果：
- 任务创建成功
- 最终任务状态为 `completed`
- 结果区出现分析结果

### TC-019 Data Analysis 结果内容正确

前置条件：
- 已完成 TC-018

步骤：
1. 查看分析结果

预期结果：
- 存在 `summaryMd`
- 存在 `insights`
- `insights` 至少包含 1 条内容

## 4.8 Charts & Graphs

### TC-020 Chart 任务创建成功

前置条件：
- 已登录
- 已上传有效 Workbook

步骤：
1. 进入 `/charts`
2. 选择 Workbook
3. 输入：`Create the most suitable chart for revenue trend over time.`
4. 提交

预期结果：
- 任务创建成功
- 最终状态为 `completed`
- 结果区直接出现 Charts / Graphs 图表预览
- 图表下方仍可看到配置摘要或预览数据表

### TC-021 Chart 结果结构正确

前置条件：
- 已完成 TC-020

步骤：
1. 查看图表结果

预期结果：
- 页面可直接看到图表或图形预览，而不是仅显示 JSON
- 存在 `chartType`
- 存在 `xAxis`
- 存在 `yAxis`
- 存在 `config`

## 4.9 Reports

### TC-022 Report 任务创建成功

前置条件：
- 已登录
- 已上传有效 Workbook

步骤：
1. 进入 `/reports`
2. 选择 Workbook
3. 输入：`Generate an executive summary report for this workbook.`
4. 选择 `md`
5. 提交

预期结果：
- 任务创建成功
- 最终状态为 `completed`
- 结果区出现 Markdown 报告内容

### TC-023 Report 结果展示正常

前置条件：
- 已完成 TC-022

步骤：
1. 查看报告结果

预期结果：
- 存在 `contentMd`
- 页面可展示英文 Markdown 结果
- 报告正文不应包含中文

## 4.10 Billing

### TC-024 Billing 页面展示正常

前置条件：
- 已登录

步骤：
1. 进入 `/billing`

预期结果：
- 页面正常打开
- 可看到当前套餐
- 可看到 Credits 摘要
- 无接口错误

### TC-025 Billing 升级流程当前不作为阻塞项

前置条件：
- 已登录

步骤：
1. 进入 `/billing`
2. 检查当前页面内容
3. 如需额外验证，可单独手工调用 `POST /api/billing/checkout`

预期结果：
- 当前页面以展示套餐与额度摘要为主
- 页面应提供真实的 `Upgrade to Pro` / `Upgrade to Pro Plus` 按钮
- 若已配置 Stripe 密钥，点击后应跳转到真实 Checkout

## 4.11 Usage History

### TC-026 Usage 页面展示正常

前置条件：
- 已登录

步骤：
1. 进入 `/usage`

预期结果：
- 页面正常打开
- 可看到额度摘要
- 可看到 Recent events 区域

### TC-027 Usage 记录可累计

前置条件：
- 已执行至少 1 次上传
- 已执行至少 1 次 Assistant
- 已执行至少 1 次任意工具任务

步骤：
1. 打开 Usage 页面

预期结果：
- 可看到使用记录
- 使用次数或积分有变化
- 上传本身不应产生积分扣减

## 4.12 负向与异常场景

### TC-028 未登录访问受保护页面

前置条件：
- 已退出登录

步骤：
1. 访问 `/assistant`
2. 访问 `/dashboard`
3. 访问 `http://127.0.0.1:3001/api/auth/me`

预期结果：
- 相关数据接口返回未授权
- 前端可表现为错误提示、空态、未授权态，或回到登录页
- 当前版本不强制要求必须自动重定向到 `/login`

### TC-029 AI Provider 未配置时降级行为

前置条件：
- 暂时清空 `AI_PROVIDER_API_KEY`

步骤：
1. 重启后端
2. 执行 Assistant 或任一任务

预期结果：
- 系统仍能返回 fallback 结果
- 不因缺少 AI Key 直接崩溃

### TC-030 Google 登录失败时错误提示可见

前置条件：
- 临时制造错误配置，例如错误回调地址

步骤：
1. 点击 Google 登录

预期结果：
- 页面可带 `error` 和 `detail` 回到登录页
- 后端日志有明确错误信息

---

## 5. 推荐执行顺序

建议按下面顺序执行，排查效率最高：

1. TC-001
2. TC-002
3. TC-003
4. TC-004
5. TC-007
6. TC-009
7. TC-012
8. TC-013
9. TC-014
10. TC-016
11. TC-018
12. TC-020
13. TC-022
14. TC-024
15. TC-026
16. TC-006
17. TC-028

---

## 6. 测试记录模板

可按以下格式记录：

```text
测试日期：
测试环境：
测试账号：
测试文件：
用例编号：
执行结果：通过 / 失败
问题描述：
日志位置：
截图位置：
```

---

## 7. 本轮重点验收结论

如果以下 8 项都通过，可认为 Google 账号主链路已基本满足当前版本测试要求：

1. Google 登录成功
2. `/api/auth/me` 返回真实用户
3. CSV 上传成功
4. Assistant 回复成功
5. Pivot 结果返回成功
6. Data Analysis 结果返回成功
7. Chart 结果返回成功
8. Report 结果返回成功
