# GPTExcel 类产品数据库表设计

版本：V1.0  
日期：2026-08-10  
关联文档：
- `businessFunction/gptexcel-prd.md`
- `businessFunction/gptexcel-tech-architecture.md`

## 1. 设计目标

本文档定义 MVP 阶段的数据库表、字段、关系、索引与约束，供：

- Prisma Schema 设计
- PostgreSQL 建表
- 后端 NestJS Module 拆分
- 后续数据迁移与审计

## 2. 设计原则

- 主数据库：PostgreSQL
- 主键统一使用 `uuid`
- 时间字段统一使用 `timestamptz`
- 软删除只在必要表启用，MVP 默认物理删除或状态删除
- 高变化配置优先放 `jsonb`
- 枚举优先使用字符串字段 + 应用层常量，避免过早绑定数据库 enum

## 3. 命名规范

- 表名：复数小写下划线，如 `assistant_threads`
- 主键：`id`
- 外键：`xxx_id`
- 时间字段：
  - `created_at`
  - `updated_at`
  - 按需增加 `completed_at`、`failed_at`

## 4. 关系总览

```text
users
  ├─ oauth_accounts
  ├─ subscriptions
  ├─ billing_webhook_events
  ├─ workbooks
  │    ├─ workbook_sheets
  │    ├─ assistant_threads
  │    │    └─ assistant_messages
  │    ├─ pivot_jobs
  │    ├─ analysis_jobs
  │    ├─ chart_jobs
  │    └─ report_jobs
  ├─ ai_requests
  ├─ usage_counters
  └─ usage_events
```

## 5. 核心枚举建议

### 5.1 users.plan

- `free`
- `pro`
- `pro_plus`
- `team`
- `admin`

### 5.2 subscriptions.status

- `trialing`
- `active`
- `past_due`
- `canceled`
- `incomplete`
- `unpaid`

### 5.3 workbooks.status

- `uploaded`
- `parsing`
- `ready`
- `failed`
- `archived`

### 5.4 各类 job.status

- `queued`
- `running`
- `completed`
- `failed`
- `canceled`

### 5.5 ai_requests.tool_type

- `assistant`
- `pivot_builder`
- `data_analysis`
- `charts`
- `reports`
- `file_upload`

### 5.6 usage_counters.metric_type

- `spreadsheet_assistant`
- `pivot_builder`
- `data_analysis`
- `charts`
- `reports`
- `file_upload`
- `credit_total`
- `sol_usage`

### 5.7 billing_webhook_events.provider

- `stripe`

## 6. 表设计

## 6.1 users

用途：用户主表。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| id | uuid | 是 | gen_random_uuid() | 主键 |
| email | varchar(255) | 是 |  | 主邮箱，唯一 |
| name | varchar(120) | 否 |  | 展示名称 |
| avatar_url | text | 否 |  | 头像 |
| plan | varchar(32) | 是 | `free` | 当前套餐 |
| locale | varchar(16) | 否 | `en` | 语言 |
| timezone | varchar(64) | 否 | `Asia/Shanghai` | 时区 |
| status | varchar(32) | 是 | `active` | 用户状态 |
| last_login_at | timestamptz | 否 |  | 最近登录 |
| created_at | timestamptz | 是 | now() | 创建时间 |
| updated_at | timestamptz | 是 | now() | 更新时间 |

约束：

- `UNIQUE(email)`

索引：

- `idx_users_plan(plan)`
- `idx_users_created_at(created_at desc)`

## 6.2 oauth_accounts

用途：第三方登录绑定表。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| id | uuid | 是 | gen_random_uuid() | 主键 |
| user_id | uuid | 是 |  | 关联 `users.id` |
| provider | varchar(32) | 是 |  | `google` / `microsoft` |
| provider_account_id | varchar(255) | 是 |  | 第三方账户唯一标识 |
| provider_email | varchar(255) | 否 |  | 第三方邮箱 |
| access_token_encrypted | text | 否 |  | 可选，若需长期调用 |
| refresh_token_encrypted | text | 否 |  | 可选 |
| token_expires_at | timestamptz | 否 |  | 可选 |
| created_at | timestamptz | 是 | now() | 创建时间 |
| updated_at | timestamptz | 是 | now() | 更新时间 |

约束：

- `FOREIGN KEY (user_id) REFERENCES users(id)`
- `UNIQUE(provider, provider_subscription_id)`
- `UNIQUE(provider, provider_account_id)`

索引：

- `idx_oauth_accounts_user_id(user_id)`

## 6.3 subscriptions

用途：订阅与 Stripe 映射。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| id | uuid | 是 | gen_random_uuid() | 主键 |
| user_id | uuid | 是 |  | 用户 |
| provider | varchar(32) | 是 | `stripe` | 支付渠道 |
| provider_customer_id | varchar(255) | 否 |  | Stripe Customer ID |
| provider_subscription_id | varchar(255) | 否 |  | Stripe Subscription ID |
| plan_code | varchar(64) | 是 |  | `pro_monthly` 等 |
| status | varchar(32) | 是 |  | 订阅状态 |
| currency | varchar(8) | 是 | `usd` | 币种 |
| amount_cents | integer | 是 |  | 单周期金额，分 |
| interval | varchar(16) | 是 |  | `month` / `year` |
| current_period_start | timestamptz | 否 |  | 当前周期开始 |
| current_period_end | timestamptz | 否 |  | 当前周期结束 |
| cancel_at_period_end | boolean | 是 | false | 是否到期取消 |
| created_at | timestamptz | 是 | now() | 创建时间 |
| updated_at | timestamptz | 是 | now() | 更新时间 |

约束：

- `FOREIGN KEY (user_id) REFERENCES users(id)`

索引：

- `idx_subscriptions_user_id(user_id)`
- `idx_subscriptions_status(status)`
- `idx_subscriptions_provider_subscription_id(provider_subscription_id)`

## 6.4 workbooks

用途：上传工作簿主记录。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| id | uuid | 是 | gen_random_uuid() | 主键 |
| user_id | uuid | 是 |  | 用户 |
| original_file_name | varchar(255) | 是 |  | 原始文件名 |
| file_type | varchar(16) | 是 |  | `xlsx` / `xls` / `csv` |
| mime_type | varchar(128) | 是 |  | MIME |
| object_key | text | 是 |  | 对象存储路径 |
| file_size_bytes | bigint | 是 |  | 文件大小 |
| status | varchar(32) | 是 | `uploaded` | 解析状态 |
| sheet_count | integer | 否 |  | sheet 数量 |
| row_count | integer | 否 |  | 总行数估算 |
| column_count | integer | 否 |  | 最大列数估算 |
| summary_md | text | 否 |  | 全局摘要 |
| summary_json | jsonb | 否 |  | 全局结构化摘要 |
| parse_error | text | 否 |  | 解析失败信息 |
| uploaded_at | timestamptz | 是 | now() | 上传时间 |
| parsed_at | timestamptz | 否 |  | 解析完成时间 |
| created_at | timestamptz | 是 | now() | 创建时间 |
| updated_at | timestamptz | 是 | now() | 更新时间 |

约束：

- `FOREIGN KEY (user_id) REFERENCES users(id)`

索引：

- `idx_workbooks_user_id(user_id, created_at desc)`
- `idx_workbooks_status(status)`

## 6.5 workbook_sheets

用途：工作簿每个 sheet 的解析结果。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| id | uuid | 是 | gen_random_uuid() | 主键 |
| workbook_id | uuid | 是 |  | 工作簿 |
| sheet_name | varchar(255) | 是 |  | sheet 名称 |
| sheet_index | integer | 是 |  | 顺序 |
| header_json | jsonb | 否 |  | 表头数组 |
| column_types_json | jsonb | 否 |  | 推断类型 |
| formula_columns_json | jsonb | 否 |  | 公式列信息 |
| sample_rows_json | jsonb | 否 |  | 示例行 |
| summary_md | text | 否 |  | sheet 摘要 |
| row_count | integer | 否 |  | 行数 |
| column_count | integer | 否 |  | 列数 |
| created_at | timestamptz | 是 | now() | 创建时间 |

约束：

- `FOREIGN KEY (workbook_id) REFERENCES workbooks(id) ON DELETE CASCADE`
- `UNIQUE(workbook_id, sheet_index)`

索引：

- `idx_workbook_sheets_workbook_id(workbook_id)`
- `idx_workbook_sheets_sheet_name(workbook_id, sheet_name)`

## 6.6 assistant_threads

用途：Spreadsheet Assistant 会话。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| id | uuid | 是 | gen_random_uuid() | 主键 |
| user_id | uuid | 是 |  | 用户 |
| workbook_id | uuid | 否 |  | 绑定工作簿 |
| title | varchar(255) | 否 |  | 会话标题 |
| status | varchar(32) | 是 | `active` | 会话状态 |
| created_at | timestamptz | 是 | now() | 创建时间 |
| updated_at | timestamptz | 是 | now() | 更新时间 |

约束：

- `FOREIGN KEY (user_id) REFERENCES users(id)`
- `FOREIGN KEY (workbook_id) REFERENCES workbooks(id)`

索引：

- `idx_assistant_threads_user_id(user_id, updated_at desc)`
- `idx_assistant_threads_workbook_id(workbook_id)`

## 6.7 assistant_messages

用途：会话消息。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| id | uuid | 是 | gen_random_uuid() | 主键 |
| thread_id | uuid | 是 |  | 会话 |
| role | varchar(16) | 是 |  | `user` / `assistant` / `system` |
| content | text | 是 |  | 消息内容 |
| content_json | jsonb | 否 |  | 多段内容结构 |
| metadata_json | jsonb | 否 |  | 引用 sheet、cells 等 |
| ai_request_id | uuid | 否 |  | 对应 AI 请求 |
| created_at | timestamptz | 是 | now() | 创建时间 |

约束：

- `FOREIGN KEY (thread_id) REFERENCES assistant_threads(id) ON DELETE CASCADE`

索引：

- `idx_assistant_messages_thread_id(thread_id, created_at asc)`

## 6.8 pivot_jobs

用途：透视表生成任务。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| id | uuid | 是 | gen_random_uuid() | 主键 |
| user_id | uuid | 是 |  | 用户 |
| workbook_id | uuid | 是 |  | 工作簿 |
| sheet_name | varchar(255) | 是 |  | 来源 sheet |
| prompt | text | 是 |  | 用户需求 |
| config_json | jsonb | 否 |  | 行列值筛选配置 |
| result_json | jsonb | 否 |  | 输出结果 |
| export_file_name | varchar(255) | 否 |  | 导出文件名 |
| export_file_url | text | 否 |  | 下载地址 |
| export_file_size_bytes | bigint | 否 |  | 导出文件大小 |
| export_sheet_name | varchar(255) | 否 |  | 导出的 pivot sheet 名 |
| export_status | varchar(32) | 否 |  | `pending` / `completed` / `failed` |
| export_error_message | text | 否 |  | 导出错误信息 |
| status | varchar(32) | 是 | `queued` | 状态 |
| ai_request_id | uuid | 否 |  | AI 请求 |
| error_message | text | 否 |  | 错误 |
| created_at | timestamptz | 是 | now() | 创建时间 |
| completed_at | timestamptz | 否 |  | 完成时间 |

约束：

- `FOREIGN KEY (user_id) REFERENCES users(id)`
- `FOREIGN KEY (workbook_id) REFERENCES workbooks(id)`

补充说明：

- `config_json` 保存 AI 生成的 pivot 配置
- `result_json` 保存前端展示所需结构
- 导出相关元数据建议独立列存储，不只放在 `result_json`

索引：

- `idx_pivot_jobs_user_id(user_id, created_at desc)`
- `idx_pivot_jobs_workbook_id(workbook_id)`
- `idx_pivot_jobs_status(status)`

## 6.9 analysis_jobs

用途：数据分析任务。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| id | uuid | 是 | gen_random_uuid() | 主键 |
| user_id | uuid | 是 |  | 用户 |
| workbook_id | uuid | 是 |  | 工作簿 |
| scope_json | jsonb | 否 |  | 选中的 sheets / ranges |
| prompt | text | 是 |  | 用户需求 |
| summary_md | text | 否 |  | 分析摘要 |
| insights_json | jsonb | 否 |  | 结构化洞察 |
| status | varchar(32) | 是 | `queued` | 状态 |
| complexity | varchar(16) | 否 |  | `normal` / `complex` |
| ai_request_id | uuid | 否 |  | AI 请求 |
| error_message | text | 否 |  | 错误 |
| created_at | timestamptz | 是 | now() | 创建时间 |
| completed_at | timestamptz | 否 |  | 完成时间 |

约束：

- `FOREIGN KEY (user_id) REFERENCES users(id)`
- `FOREIGN KEY (workbook_id) REFERENCES workbooks(id)`

索引：

- `idx_analysis_jobs_user_id(user_id, created_at desc)`
- `idx_analysis_jobs_status(status)`

## 6.10 chart_jobs

用途：图表生成任务。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| id | uuid | 是 | gen_random_uuid() | 主键 |
| user_id | uuid | 是 |  | 用户 |
| workbook_id | uuid | 是 |  | 工作簿 |
| analysis_job_id | uuid | 否 |  | 依赖分析任务 |
| prompt | text | 是 |  | 用户需求 |
| chart_type | varchar(64) | 否 |  | `bar` / `line` / `pie` 等 |
| config_json | jsonb | 否 |  | 图表配置 |
| preview_json | jsonb | 否 |  | 前端预览数据 |
| status | varchar(32) | 是 | `queued` | 状态 |
| ai_request_id | uuid | 否 |  | AI 请求 |
| error_message | text | 否 |  | 错误 |
| created_at | timestamptz | 是 | now() | 创建时间 |
| completed_at | timestamptz | 否 |  | 完成时间 |

约束：

- `FOREIGN KEY (user_id) REFERENCES users(id)`
- `FOREIGN KEY (workbook_id) REFERENCES workbooks(id)`
- `FOREIGN KEY (analysis_job_id) REFERENCES analysis_jobs(id)`

索引：

- `idx_chart_jobs_user_id(user_id, created_at desc)`
- `idx_chart_jobs_status(status)`

## 6.11 report_jobs

用途：报告生成与导出任务。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| id | uuid | 是 | gen_random_uuid() | 主键 |
| user_id | uuid | 是 |  | 用户 |
| workbook_id | uuid | 是 |  | 工作簿 |
| analysis_job_id | uuid | 否 |  | 依赖分析任务 |
| prompt | text | 是 |  | 用户需求 |
| format | varchar(16) | 是 | `md` | `md` / `docx` / `pdf` |
| content_md | text | 否 |  | 报告 markdown |
| export_file_url | text | 否 |  | 导出文件地址 |
| status | varchar(32) | 是 | `queued` | 状态 |
| complexity | varchar(16) | 否 |  | `normal` / `complex` |
| ai_request_id | uuid | 否 |  | AI 请求 |
| error_message | text | 否 |  | 错误 |
| created_at | timestamptz | 是 | now() | 创建时间 |
| completed_at | timestamptz | 否 |  | 完成时间 |

约束：

- `FOREIGN KEY (user_id) REFERENCES users(id)`
- `FOREIGN KEY (workbook_id) REFERENCES workbooks(id)`
- `FOREIGN KEY (analysis_job_id) REFERENCES analysis_jobs(id)`

索引：

- `idx_report_jobs_user_id(user_id, created_at desc)`
- `idx_report_jobs_status(status)`

## 6.12 ai_requests

用途：统一 AI 调用审计表。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| id | uuid | 是 | gen_random_uuid() | 主键 |
| user_id | uuid | 是 |  | 用户 |
| tool_type | varchar(32) | 是 |  | 工具类型 |
| model_provider | varchar(32) | 是 | `openai` | 提供商 |
| model_name | varchar(64) | 是 |  | `gpt-5.6-terra` 等 |
| prompt_version | varchar(32) | 否 |  | Prompt 版本 |
| input_ref_json | jsonb | 否 |  | 输入引用、上下文 ID、脱敏摘要 |
| output_ref_json | jsonb | 否 |  | 输出引用、结果 ID、脱敏摘要 |
| input_tokens | integer | 否 |  | 输入 tokens |
| output_tokens | integer | 否 |  | 输出 tokens |
| latency_ms | integer | 否 |  | 延迟 |
| cost_usd | numeric(12,6) | 否 |  | 估算成本 |
| redaction_level | varchar(32) | 否 | `summary_only` | 脱敏等级 |
| status | varchar(32) | 是 |  | `completed` / `failed` |
| error_code | varchar(64) | 否 |  | 错误码 |
| error_message | text | 否 |  | 错误信息 |
| created_at | timestamptz | 是 | now() | 创建时间 |

约束：

- `FOREIGN KEY (user_id) REFERENCES users(id)`

索引：

- `idx_ai_requests_user_id(user_id, created_at desc)`
- `idx_ai_requests_tool_type(tool_type)`
- `idx_ai_requests_model_name(model_name)`

说明：

- 不存原始输入输出全文
- 只存 prompt 版本、上下文引用、token 数、耗时、模型和脱敏审计信息

## 6.13 usage_counters

用途：周期额度聚合表。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| id | uuid | 是 | gen_random_uuid() | 主键 |
| user_id | uuid | 是 |  | 用户 |
| metric_type | varchar(32) | 是 |  | 计数类型 |
| period_type | varchar(16) | 是 |  | `month` / `rolling_12h` |
| period_start | timestamptz | 是 |  | 周期开始 |
| period_end | timestamptz | 是 |  | 周期结束 |
| used_count | integer | 是 | 0 | 已用值 |
| updated_at | timestamptz | 是 | now() | 更新时间 |

约束：

- `FOREIGN KEY (user_id) REFERENCES users(id)`
- `UNIQUE(user_id, metric_type, period_type, period_start)`

说明：

- `rolling_12h` 表示滚动 12 小时窗口，不是固定 0-12 / 12-24 时间段
- `period_start` 和 `period_end` 只作为当次窗口快照

索引：

- `idx_usage_counters_user_id(user_id)`
- `idx_usage_counters_period(period_end)`

## 6.14 usage_events

用途：逐次扣费与审计事件。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| id | uuid | 是 | gen_random_uuid() | 主键 |
| user_id | uuid | 是 |  | 用户 |
| tool_type | varchar(32) | 是 |  | 任务类型 |
| action_type | varchar(32) | 是 |  | `consume` / `refund` |
| request_id | uuid | 否 |  | 关联 AI 请求 |
| source_job_id | uuid | 否 |  | 关联业务任务 ID |
| source_job_type | varchar(32) | 否 |  | `analysis_job` 等 |
| credit_delta | integer | 是 |  | 增减值 |
| metadata_json | jsonb | 否 |  | 备注 |
| created_at | timestamptz | 是 | now() | 创建时间 |

约束：

- `FOREIGN KEY (user_id) REFERENCES users(id)`

索引：

- `idx_usage_events_user_id(user_id, created_at desc)`
- `idx_usage_events_request_id(request_id)`

## 6.15 billing_webhook_events

用途：Stripe Webhook 幂等与审计。

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| id | uuid | 是 | gen_random_uuid() | 主键 |
| provider | varchar(32) | 是 | `stripe` | 渠道 |
| provider_event_id | varchar(255) | 是 |  | Stripe event.id |
| event_type | varchar(128) | 是 |  | 事件类型 |
| provider_subscription_id | varchar(255) | 否 |  | 订阅 ID |
| payload_json | jsonb | 是 |  | 原始事件载荷 |
| status | varchar(32) | 是 | `received` | `received` / `processed` / `failed` |
| processed_at | timestamptz | 否 |  | 处理完成时间 |
| error_message | text | 否 |  | 失败原因 |
| created_at | timestamptz | 是 | now() | 创建时间 |

约束：

- `UNIQUE(provider, provider_event_id)`

索引：

- `idx_billing_webhook_events_provider_event_id(provider, provider_event_id)`
- `idx_billing_webhook_events_status(status)`

## 7. 推荐外键删除策略

- `users` -> 子表：默认 `RESTRICT`
- `workbooks` -> `workbook_sheets`：`CASCADE`
- `assistant_threads` -> `assistant_messages`：`CASCADE`
- 业务任务表默认不做级联删除，避免历史审计丢失

## 8. 推荐 Prisma 额外约束

- 所有 `jsonb` 字段在应用层加 schema 校验
- 金额统一用整数分或 `numeric(12,6)`，不要用 float
- `updated_at` 使用中间件自动刷新

## 9. 首批迁移顺序

1. `users`
2. `oauth_accounts`
3. `subscriptions`
4. `workbooks`
5. `workbook_sheets`
6. `assistant_threads`
7. `assistant_messages`
8. `pivot_jobs`
9. `analysis_jobs`
10. `chart_jobs`
11. `report_jobs`
12. `ai_requests`
13. `usage_counters`
14. `usage_events`
15. `billing_webhook_events`
