# GPTExcel 类产品技术架构设计

版本：V1.0  
日期：2026-08-06  
关联文档：
- `businessFunction/gptexcel-prd.md`
- `businessFunction/native-pivot-export-decision.md`

## 1. 文档目标

本文档用于把 PRD 转换为可执行的技术方案，覆盖：

- 系统分层
- 技术选型
- 核心服务边界
- 数据模型落地方式
- AI 调用链路
- 计费与配额控制
- 部署与运维建议

目标不是一次性定义最终架构，而是给 MVP 开发提供稳定骨架。

## 2. 总体技术目标

- 支持围绕表格任务的统一登录后台
- 支持 Spreadsheet Assistant、Pivot Builder、Data Analysis、Charts & Graphs、Reports 共用 AI 能力
- 支持免费额度、付费订阅、用量统计
- 支持后续扩展更多表格自动化能力
- 保持 MVP 架构简单，避免过早微服务化

## 3. 架构原则

- 单体优先：MVP 阶段优先使用模块化单体，而不是拆多个独立服务。
- BFF 优先：前端只调用统一后端 API，不直接连接 AI 提供商。
- 配额前置：所有 AI 能力调用前必须经过权限和额度校验。
- Prompt 解耦：工具定义、提示词模板、模型路由分离配置。
- 可观测优先：所有生成请求必须有日志、耗时、配额、错误记录。
- 认证统一：仅支持 Google / Microsoft 第三方登录，不提供邮箱密码体系。

## 4. 推荐技术选型

## 4.1 前端

- 框架：Next.js
- 语言：TypeScript
- UI：Tailwind CSS + headless 组件
- 状态管理：React Query + 轻量本地状态
- 鉴权会话：前端仅接收后端签发的 HttpOnly JWT Cookie（access_token + refresh_token）

原因：

- 同时适合营销页和登录后后台
- 路由清晰，利于构建 `/dashboard`、`/assistant`、`/pivot-builder` 等页面
- 后续如果需要 SSR、SEO、博客页，也更顺手

## 4.2 后端

- 运行时：Node.js
- 框架：NestJS
- 认证方案：NestJS + Passport + Google / Microsoft OAuth
- 会话方案：JWT + Refresh Token，均通过 HttpOnly Cookie 下发

原因：

- 模块边界清晰，适合用户、AI、配额、支付、统计等模块拆分
- 适合做统一 AI Gateway 和中间件能力
- 前后端分离时更容易统一处理刷新、登出、401 重试

建议约定：

- `access_token` 有效期建议 15 分钟
- `refresh_token` 有效期建议 30 天
- 前端收到 `401` 后先调用刷新接口，刷新失败再跳转登录页

## 4.3 数据库

- 主数据库：PostgreSQL
- ORM：Prisma
- 缓存：Redis

原因：

- PostgreSQL 足够支撑用户、订阅、消息、用量、日志数据
- Prisma 适合快速建模和迁移
- Redis 可承接限流、会话缓存、热点数据缓存

## 4.4 存储

- 对象存储：S3 兼容存储
- 用途：导出模板文件、上传文件、结果附件

## 4.5 支付

- Stripe

原因：

- 订阅制成熟
- Webhook 能力完整
- 后续支持月付/年付和套餐管理

## 4.6 AI 层

- 模型接入方式：统一 AI Gateway
- 首期建议：单供应商接入 + 可扩展抽象层
- 后续可扩展：OpenAI / Anthropic / Gemini / OpenRouter
- 主模型建议：默认用 `gpt-5.6-terra`，复杂推理或高价值任务用 `gpt-5.6-sol`，高频低成本任务用 `gpt-5.6-luna`

原则：

- 前端绝不直接暴露模型密钥
- 不同工具页可以共用一个模型，也可后续按工具切换模型
- Excel 文件不要直接当成“纯文本 prompt”硬塞给模型；应先上传、落盘、解析，再把结构化内容交给模型

### 4.6.1 Excel 文件处理链路

推荐流程：

1. 前端上传 `.xlsx` / `.csv`
2. 后端保存原文件到对象存储
3. 后端解析工作簿，提取 sheet 名、表头、样例行、公式列、数据规模
4. 将原始表格转换成通用中间表示：
   - `Markdown`：给模型阅读的主摘要
   - `JSON`：保留 sheet、列类型、范围、公式等结构化信息
   - `CSV`：保留局部数据块，便于精确分析
5. 针对用户问题，选择相关 sheet 或行列范围，拼成 `MD + JSON` 的提示上下文
6. 如需复杂计算、跨表推导或文件级分析，再让模型通过 Responses API 的 `code interpreter` 处理原文件或指定附件

### 4.6.2 何时用哪种方式

- 公式生成 / 解释：优先发送 `Markdown` 摘要 + 少量 `JSON` 结构，不必整本工作簿全量入模
- 数据分析 / 计算：优先用解析后的结构化片段；需要实际运算时交给 `code interpreter`
- 大文件搜索 / 定位：优先抽取相关 sheet，再送模型；若后续做知识检索型功能，可考虑 `file search`
- 模板生成：不依赖原始文件，直接让模型输出表结构和公式建议，再由后端生成 `.xlsx`

### 4.6.3 传给模型的内容

建议发送：

- `Markdown` 形式的 sheet 摘要
- `JSON` 形式的表结构信息
- sheet 名称
- 每个 sheet 的表头
- 关键列的数据类型
- 少量代表性样例行
- 用户明确指出的单元格范围
- 任务目标

不建议直接发送：

- 整个超大工作簿的原始二进制内容
- 无关 sheet 的全部数据
- 敏感明细未脱敏就直接入模

### 4.6.4 存储与脱敏

- AI 请求审计表不保存原始输入输出全文
- 仅保存 `prompt_version`、token 数、耗时、模型名、上下文引用 ID、脱敏摘要或哈希
- 工作簿原文只保留在对象存储和业务表中，避免重复落库

## 5. 总体架构图

```text
[Web Frontend / Next.js]
        |
        v
[API Layer / BFF]
        |
        +-- Auth Module
        +-- User Module
        +-- AI Module
        +-- Workbook Module
        +-- Usage Module
        +-- Billing Module
        |
        +--> [PostgreSQL]
        +--> [Redis]
        +--> [Object Storage]
        +--> [Stripe]
        +--> [LLM Provider]
```

## 6. 模块划分

## 6.1 Frontend 模块

- Marketing Site
- Auth Pages
- Dashboard
- Spreadsheet Assistant
- Pivot Builder
- Data Analysis
- Charts & Graphs
- Reports
- File Upload
- Billing Page
- Usage Page
- Shared Components

关键共享组件：

- Sidebar
- QuotaCard
- GeneratorWorkspace
- ResultPanel
- CopyButton
- UpgradeBanner

## 6.2 Backend 模块

### Auth Module

职责：

- Google 登录
- Microsoft 登录
- OAuth 回调处理
- JWT（httpOnly Cookie）管理
- 第三方账号绑定
- 用户信息读取

建议流程：

- 前端点击 Google / Microsoft 按钮
- 跳转后端 OAuth 发起接口
- NestJS Passport 完成回调处理
- 后端创建或绑定本地用户
- 签发 JWT（access_token + refresh_token，均存于 httpOnly Cookie）

### User Module

职责：

- 用户资料
- 套餐信息
- 偏好设置

### AI Module

职责：

- Prompt 构建
- 模型路由
- 结果标准化
- 请求日志记录

子模块建议：

- `SpreadsheetAssistantService`
- `PivotBuilderService`
- `DataAnalysisService`
- `ChartsService`
- `ReportsService`
- `WorkbookSummaryService`
- `PromptTemplateService`
- `ModelRouterService`

### Usage Module

职责：

- 配额判断
- 用量扣减
- 周/月统计
- 页面展示聚合

### Billing Module

职责：

- 套餐读取
- Stripe Checkout Session 创建
- Stripe Webhook 处理
- 订阅同步

### Workbook Module

职责：

- 文件上传
- 工作簿解析
- sheet 摘要生成
- 文件元数据
- 对象存储读写

MVP 阶段可以先预留模块，不必须完整上线。

### Analytics Module

职责：

- 行为埋点
- 后台分析数据聚合

## 7. 核心数据流

## 7.1 Workbook Ingestion 链路

```text
Frontend Upload
-> Auth Check
-> File Validation
-> Store Raw File
-> Parse Sheets
-> Generate MD/JSON/CSV Summary
-> Persist Workbook Metadata
-> Return Workbook ID
```

关键点：

- 原文件和结构化摘要分开存
- 解析失败要给出可重试错误
- 摘要要支持后续多个任务复用

## 7.2 Spreadsheet Assistant 链路

```text
User Ask Question
-> Auth Check
-> Quota Check
-> Load Workbook Summary
-> Build Prompt
-> Call LLM
-> Save Thread Message
-> Return Answer
```

## 7.3 Pivot Builder 链路

```text
Select Workbook + Sheet
-> Auth Check
-> Quota Check
-> Build Pivot Context
-> Call LLM
-> Call Java Pivot Export Service
-> Save Export Metadata
-> Return Pivot Config + Download URL
```

补充说明：

- Pivot Builder 的最终目标不是只返回 JSON 配置，而是生成 Excel 原生 PivotTable 文件。
- NestJS 负责 AI 配置生成、任务编排、权限校验、额度扣减、下载鉴权。
- Java Apache POI 服务负责生成带 Pivot Cache / PivotTable 结构的 `.xlsx`。
- 详细方案见 `businessFunction/native-pivot-export-decision.md`。

## 7.4 Data Analysis / Charts / Reports 链路

```text
Load Workbook Summary
-> Auth Check
-> Quota Check
-> Build Analysis Prompt
-> Create Job
-> Enqueue Worker
-> Stream / Poll Status
-> Save Job Result
-> Optionally Render Chart/Report Output
```

说明：

- `Data Analysis` 和 `Reports` 采用异步 Job 模式，避免长耗时请求阻塞 HTTP 连接
- 前端可通过 SSE 订阅进度，或轮询 job status 接口
- `Charts & Graphs` 若后续出现长耗时场景，也可复用同一 Job 模式

## 7.5 Billing 链路

```text
User Click Upgrade
-> Create Stripe Checkout Session
-> Redirect to Stripe
-> Payment Success Webhook
-> Update Subscription
-> Refresh User Quota Rules
```

Webhook 幂等要求：

- 先校验 Stripe 签名
- 再按 `event.id` 做去重
- 订阅状态更新按 `provider_subscription_id` 幂等 upsert
- Webhook 处理结果需要落表，避免重复事件导致状态错乱

## 8. 数据库设计建议

## 8.1 用户相关

### users

- id
- email
- name
- avatar_url
- plan
- locale
- created_at
- updated_at

### oauth_accounts

- id
- user_id
- provider
- provider_account_id
- provider_email
- created_at
- updated_at

### subscriptions

- id
- user_id
- provider
- provider_customer_id
- provider_subscription_id
- plan_code
- status
- current_period_start
- current_period_end
- cancel_at_period_end
- created_at
- updated_at

## 8.2 工作簿相关

### workbooks

- id
- user_id
- original_file_name
- file_type
- object_key
- status
- sheet_count
- row_count
- created_at
- updated_at

### workbook_sheets

- id
- workbook_id
- sheet_name
- sheet_index
- header_json
- sample_rows_json
- summary_md
- created_at

## 8.3 任务相关

### assistant_threads

- id
- user_id
- workbook_id
- title
- created_at
- updated_at

### assistant_messages

- id
- thread_id
- role
- content
- metadata_json
- created_at

### pivot_jobs

- id
- user_id
- workbook_id
- sheet_name
- config_json
- result_json
- status
- created_at

### analysis_jobs

- id
- user_id
- workbook_id
- prompt
- summary_md
- insights_json
- status
- created_at

### chart_jobs

- id
- user_id
- workbook_id
- chart_type
- config_json
- preview_json
- status
- created_at

### report_jobs

- id
- user_id
- workbook_id
- format
- content_md
- file_url
- status
- created_at

## 8.4 AI 请求相关

### ai_requests

- id
- user_id
- tool_type
- mode
- model_provider
- model_name
- prompt_version
- input_ref_json
- output_ref_json
- status
- latency_ms
- token_input
- token_output
- error_code
- created_at

说明：

- 即使竞品未公开模型名，我们自己的系统仍然应该记录实际调用的 provider 和 model_name，便于排障和成本分析。
- 不存原始输入输出全文，只存 prompt 版本、上下文引用、token 数和脱敏后的审计信息

## 8.5 配额与统计相关

### usage_counters

- id
- user_id
- metric_type
- period_type
- period_start
- period_end
- used_count
- updated_at

建议 `metric_type`：

- spreadsheet_assistant
- pivot_builder
- data_analysis
- charts
- reports
- file_upload

### usage_events

- id
- user_id
- tool_type
- action_type
- request_id
- count_delta
- created_at

## 9. 配额系统设计

## 9.1 MVP 计数规则

免费版建议：

- Spreadsheet Assistant：按月计数
- Pivot Builder / Data Analysis / Charts / Reports / File Upload：按滚动 12 小时窗口计数

付费版建议：

- Spreadsheet Assistant：按月计数
- Pivot Builder / Data Analysis / Charts / Reports / File Upload：按月计数

## 9.2 判定顺序

每次请求执行顺序：

1. 验证登录状态
2. 验证用户套餐
3. 验证当前工具是否可用
4. 验证剩余额度
5. 执行 AI 请求
6. 成功后扣减额度并记录日志

## 9.3 配额实现建议

- 高频计数使用 Redis
- 落库使用 PostgreSQL
- Redis 用作实时判断
- PostgreSQL 用作账本和统计来源

这样可以避免每次都直接写数据库热点计数。

## 10. AI Gateway 设计

## 10.1 目标

把所有 AI 调用统一收口，避免各工具页自己拼 Prompt、自己调模型。

## 10.2 抽象接口

建议定义统一调用接口：

```ts
interface AiGenerationRequest {
  userId: string;
  toolType: 'assistant' | 'pivot_builder' | 'data_analysis' | 'charts' | 'reports';
  input: string;
  context?: Record<string, unknown>;
}
```

输出接口：

```ts
interface AiGenerationResponse {
  requestId: string;
  output: string;
  metadata?: {
    provider?: string;
    model?: string;
    latencyMs?: number;
  };
}
```

## 10.3 Prompt 分层

- System Prompt：定义工具角色
- Tool Prompt：定义助手/透视/分析/图表/报告规则
- User Prompt：用户输入
- Post Processor：格式清洗、代码块规范化、解释格式统一

## 10.4 模型路由策略

MVP 建议：

- `Spreadsheet Assistant` / `Pivot Builder`：优先 `gpt-5.6-luna` 或 `gpt-5.6-terra`
- `Data Analysis` / `Charts & Graphs` / `Reports`：优先 `gpt-5.6-terra`
- 复杂分析、长报告、高价值任务：切换 `gpt-5.6-sol`

后续优化方向：

- 低成本模型处理简单问答和字段解释
- 高能力模型处理跨 sheet 分析和长报告

## 11. API 设计建议

## 11.1 API 风格

- 使用 REST 即可
- 统一返回结构
- 所有接口返回 `requestId`

统一响应建议：

```json
{
  "success": true,
  "data": {},
  "requestId": "req_xxx",
  "error": null
}
```

## 11.2 核心接口

### Auth

- `GET /api/auth/google`
- `GET /api/auth/microsoft`
- `GET /api/auth/google/callback`
- `GET /api/auth/microsoft/callback`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Chat

- `GET /api/assistant/threads`
- `POST /api/assistant/threads`
- `GET /api/assistant/threads/:id/messages`
- `POST /api/assistant/threads/:id/messages/stream`

### Workbook

- `POST /api/files/upload`
- `GET /api/files/:id/preview`

### Tasks

- `POST /api/pivot-builder`
- `POST /api/data-analysis`
- `POST /api/charts`
- `POST /api/reports`
- `GET /api/jobs/:id/status`
- `GET /api/jobs/:id/result`
- `GET /api/jobs/:id/stream`

### Usage

- `GET /api/usage/summary`
- `GET /api/usage/history`

### Billing

- `GET /api/billing/summary`
- `POST /api/billing/checkout`
- `POST /api/billing/webhook`

## 12. 前端页面架构建议

## 12.1 路由

- `/`
- `/pricing`
- `/login`
- `/dashboard`
- `/assistant`
- `/pivot-builder`
- `/data-analysis`
- `/charts`
- `/reports`
- `/files`
- `/billing`
- `/usage`

## 12.2 页面组件复用

建议抽一个通用 `TaskWorkspace`：

- Header
- DataSourceSelector
- ModeSelector
- InputTextarea
- ActionButtons
- ResultPanel

适用页面：

- Spreadsheet Assistant
- Pivot Builder
- Data Analysis
- Charts & Graphs
- Reports

这样能显著降低开发和维护成本。

## 13. 安全设计

- 不存储用户密码
- API 必须校验用户身份
- 所有 AI 接口必须做速率限制
- 输入内容长度必须限制
- 导出文件必须做权限校验
- Stripe Webhook 必须校验签名并做事件幂等
- 上传文件必须校验 MIME、大小、扩展名

## 13.1 上传限制

- 仅允许 `.xlsx`、`.xls`、`.csv`
- Free：单文件最大 5MB
- Pro：单文件最大 50MB
- Pro Plus：单文件最大 100MB（对应 PRD 中已定义的 Pro Plus 套餐）
- 解析超时和行数上限需要单独配置，避免超大文件拖垮 Worker

## 13.2 CORS 与刷新

- `Access-Control-Allow-Origin` 必须来自环境变量白名单
- `Access-Control-Allow-Credentials: true`
- 前端请求业务接口时必须携带 `credentials: include`
- 前端遇到 `401` 时先尝试 `POST /api/auth/refresh`
- 刷新失败后统一跳转 `/login`

## 14. 日志与监控

必须监控的内容：

- API 成功率
- API 延迟
- LLM 延迟
- LLM 错误率
- Stripe Webhook 成功率
- Redis 可用性
- PostgreSQL 可用性

建议日志字段：

- requestId
- userId
- route
- toolType
- provider
- model
- latencyMs
- statusCode
- errorCode

## 15. 部署建议

## 15.1 MVP 部署方式

- Frontend：Vercel 或 Node 容器
- Backend：独立 Node 服务
- DB：托管 PostgreSQL
- Redis：托管 Redis
- Storage：S3 兼容对象存储

建议：

- 前后端可同仓库 monorepo
- 部署先以“1 前端 + 1 后端 + 1 数据库”模式启动

## 15.2 环境划分

- local
- dev
- staging
- production

## 15.3 环境变量

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `ACCESS_TOKEN_TTL`
- `REFRESH_TOKEN_TTL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `AI_PROVIDER_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `CORS_ORIGINS`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_BUCKET`

## 16. 开发拆分建议

## 阶段 1（2 周）

目标：打通登录、文件、助手三条主链路，并完成可演示的产品骨架。

### 第 1 周

- 第 1 天：冻结路由、接口口径、环境变量、目录结构
- 交付：路由表、接口清单、环境变量清单、目录结构草案
- 验收：架构与 PRD 口径一致，前后端可按同一份清单开工
- 第 2 天：搭建 NestJS / Prisma / PostgreSQL / Redis 基础工程
- 交付：后端骨架、基础模块、数据库连接、迁移脚本
- 验收：服务可启动，能连通数据库与缓存
- 第 3 天：完成 Google / Microsoft OAuth 与 JWT httpOnly Cookie
- 交付：OAuth 登录、回调、用户绑定、Cookie 签发
- 验收：可完成第三方登录并返回当前用户
- 第 4 天：完成 `GET /api/auth/me`、`POST /api/auth/refresh`、`POST /api/auth/logout`
- 交付：鉴权中间件、刷新接口、退出接口
- 验收：可恢复会话、可退出登录、401 可重试刷新
- 第 5 天：完成 Dashboard、Sidebar、QuotaCard 的基础框架
- 交付：登录后首页骨架、导航、额度展示、工具入口
- 验收：可进入核心页面，基础状态可见

### 第 2 周

- 第 6 天：完成 Workbook 上传接口、文件校验、对象存储落盘
- 交付：上传 API、校验规则、对象存储写入
- 验收：可上传 Excel / CSV 并生成 workbook 记录
- 第 7 天：完成 Workbook 解析、摘要、预览接口
- 交付：解析服务、sheet 摘要、预览 API
- 验收：可看到 sheet、表头、样例行和摘要
- 第 8 天：完成 Spreadsheet Assistant 会话模型与消息存储
- 交付：会话表、消息表、会话列表接口、新建会话接口
- 验收：可创建、切换、保存历史会话
- 第 9 天：完成 Spreadsheet Assistant SSE 流式响应
- 交付：SSE 流式接口、前端增量渲染、消息落库
- 验收：回答可边生成边显示，结束后可回放
- 第 10 天：完成端到端联调、错误态、基础埋点与修复
- 交付：端到端联调、空态/错误态、基础埋点、修复清单
- 验收：登录、上传、对话三条链路可稳定演示

### 阶段 1 验收

- 可完成第三方登录并恢复会话
- 可上传并预览 Excel / CSV
- 可在 Assistant 中看到流式输出
- 可在 Dashboard 看到入口、额度和基础状态

## 阶段 2

- Pivot Builder
- Data Analysis
- Charts & Graphs
- Reports
- AI Gateway
- Usage 计数

## 阶段 3

- Billing
- Stripe Webhook
- 套餐升级
- Usage History 图表
- 监控与优化

## 17. 当前建议结论

MVP 最合适的方案不是复杂微服务，而是：

- `Next.js` 做前端
- `NestJS` 做后端
- `PostgreSQL + Prisma` 做主数据
- `Redis` 做额度与缓存
- `Stripe` 做订阅
- `统一 AI Gateway` 做模型接入

这套组合足够支撑首版快速上线，也足够支撑后续从公式工具扩展为完整办公 AI 平台。

## 18. 待确认事项

- AI 模型供应商首期选哪家
- 免费版额度是否完全对标竞品
- 是否首发支持多 sheet 联动分析
- 是否首发支持报告导出格式（MD/DOCX/PDF）
