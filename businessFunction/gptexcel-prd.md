# GPTExcel 类产品 PRD

版本：V1.0  
日期：2026-08-06  
参考对象：GPTExcel.uk

## 1. 背景

GPTExcel.uk 证明了一个清晰的办公 AI 方向：围绕电子表格场景，把自然语言转成 Pivot Builder、Spreadsheet Assistant、Data Analysis、Charts & Graphs、Reports 这 5 类结果，并用后台配额和订阅完成商业化。

本 PRD 目标是定义一个可落地的同类产品 MVP，优先覆盖高频刚需场景，并保留后续扩展为多工具办公 AI 平台的能力。

## 2. 产品目标

- 让用户围绕表格任务快速完成分析、生成和输出。
- 降低 Pivot、数据分析、图表、报告的使用门槛。
- 通过免费额度 + Pro 订阅完成转化。
- 通过统一工作台承接复杂表格任务。

## 3. 目标用户

- 财务、运营、分析人员
- 中小企业办公人群
- 非技术用户
- 需要 Excel 自动化的个人和团队

## 4. MVP 范围

### P0

- Google / Microsoft 第三方登录 / 退出
- Dashboard
- Pivot Builder
- Spreadsheet Assistant
- Data Analysis
- Charts & Graphs
- Reports
- 文件上传与解析
- Billing
- Usage History
- 免费额度与升级提示

### P1

- 分享结果
- 反馈系统
- 其他高级办公工具（后续扩展）

## 5. 信息架构

### 认证入口

- Login
- OAuth Callback

### 左侧菜单

- Dashboard
- Pivot Builder
- Spreadsheet Assistant
- Data Analysis
- Charts & Graphs
- Reports
- Billing
- Usage History

### 右上角

- 通知
- 用户头像

### 侧边运营位

- Upgrade to Pro
- 配额展示
- Feedback

## 6. 页面需求

### 6.0 登录页

目标：仅提供第三方登录，不提供邮箱密码注册。

功能：

- 使用 Google 登录
- 使用 Microsoft 登录
- 登录后自动绑定/关联第三方账号
- 退出登录

验收：

- 不存在邮箱密码注册入口
- 用户可通过 Google 或 Microsoft 完成首次登录
- 已登录用户再次进入可自动恢复会话

### 6.1 Dashboard

目标：作为工具入口和转化入口。

模块：

- 工具卡片入口
- 新功能标记
- Billing 入口
- 快速升级入口

验收：

- 可点击进入所有核心工具页
- 可展示新功能标记

### 6.2 Spreadsheet Assistant

目标：作为 Spreadsheet Assistant 的统一入口，承接复杂表格问题。

功能：

- 新建会话
- 历史会话列表
- 示例提示词
- 文本输入
- 发送消息
- 清空历史
- 基础快捷工具按钮
- AI 回答采用流式输出，边生成边展示

验收：

- 可创建和切换会话
- 可返回历史内容
- 可通过示例快速发起对话

### 6.3 Pivot Builder

目标：根据数据源和分析目标，生成透视表结构与配置建议。

功能：

- 选择数据源 sheet
- 选择行/列/值/筛选项
- 自然语言描述分析目标
- 生成 Pivot 配置
- 预览结果
- 一键应用或复制配置

验收：

- 能输出可执行的透视表配置
- 能给出清晰的字段布局建议

### 6.4 Workbook Ingestion

目标：把上传的 Excel / CSV 转成可被助手、分析、图表和报告复用的结构化输入。

功能：

- 上传 Excel / XLS / CSV
- 解析 sheet、表头、样例行、公式列
- 生成 Markdown 摘要
- 生成结构化 JSON
- 提供可复用的数据片段

验收：

- 能稳定解析文件
- 能产出可供后续任务复用的中间表示

### 6.5 Data Analysis

目标：对上传的表格数据进行趋势、异常、汇总和洞察分析。

功能：

- 上传文件分析
- 自动识别表头和数据类型
- 趋势总结
- 异常值提示
- 多 sheet 联动分析
- 洞察摘要
- 采用异步任务处理，完成后再展示结果

验收：

- 能输出结构化分析结果
- 能识别关键趋势和异常

### 6.6 Charts & Graphs

目标：根据数据和分析目标生成图表建议与图表配置。

功能：

- 图表类型推荐
- 数据范围选择
- 标题与轴标签建议
- 图表预览
- 配置复制或导出

验收：

- 能推荐合适图表类型
- 能输出可复用的图表配置

### 6.7 Reports

目标：把分析结果整理成可读的报告。

功能：

- 报告结构生成
- 摘要、发现、建议输出
- 可复制的报告正文
- 导出 Markdown / DOCX / PDF
- 采用异步任务处理，完成后再展示结果

验收：

- 能输出可直接使用的报告
- 能导出标准文档格式

### 6.8 Billing

目标：展示订阅状态并完成升级。

功能：

- 当前套餐
- 配额状态
- 升级入口
- 管理订阅

验收：

- 免费/付费状态清晰可见
- 可跳转支付或管理页

### 6.9 Usage History

目标：展示用量和活跃情况。

功能：

- 周维度统计
- Chat 使用次数
- Tool 使用次数
- 分享次数
- 图表概览

验收：

- 可查看最近用量
- 可支撑升级提示

## 7. 定价建议

定价原则：

- 月费显著低于竞品 `Pro $9` / `Pro Plus $18`
- 不按 token 直卖，按任务额度和文件能力卖
- `Spreadsheet Assistant` 做低门槛引流，`Data Analysis` 和 `Reports` 承担高价值变现
- `Luna` 负责高频低成本，`Terra` 做默认，`Sol` 只用于复杂任务

### 套餐

| 套餐 | 月付 | 年付 | 适合人群 |
|---|---:|---:|---|
| Free | $0 | $0 | 体验和轻量试用 |
| Pro | $5.99 | $59 | 个人用户 / 高频办公 |
| Pro Plus | $11.99 | $119 | 重度用户 / 分析型用户 |
| Team（后续） | $29 / 座 / 月 | $299 / 座 / 年 | 小团队协作 |

### 任务权重建议

| 任务 | 权重 |
|---|---:|
| Spreadsheet Assistant | 1 |
| File Upload / Parse | 2 |
| Pivot Builder | 4 |
| Charts & Graphs | 5 |
| Data Analysis | 7 |
| Reports | 8 |
| Complex Data Analysis | 14 |
| Complex Reports | 15 |

### 套餐额度

| 套餐 | 月度额度 | 文件上限 |
|---|---:|---:|
| Free | 20 credits | 5MB |
| Pro | 120 credits | 50MB |
| Pro Plus | 300 credits | 100MB |

说明：

- 免费版只够完成基础体验，不适合重度使用
- Pro 面向大多数个人用户，价格比竞品更低
- Pro Plus 面向重度分析和报告场景，仍低于竞品月价
- 复杂分析任务可使用更高权重，避免被少量高成本请求吃掉利润

### 成本试算过程

试算日期：2026-08-10

模型价格按 OpenAI 官方文档口径估算：

- `gpt-5.6-luna`：输入 `$1 / 1M tokens`，输出 `$6 / 1M tokens`
- `gpt-5.6-terra`：输入 `$2.5 / 1M tokens`，输出 `$15 / 1M tokens`
- `gpt-5.6-sol`：输入 `$5 / 1M tokens`，输出 `$30 / 1M tokens`

单次调用成本公式：

`成本 = 输入 tokens / 1,000,000 × 输入单价 + 输出 tokens / 1,000,000 × 输出单价`

### 单次任务成本假设

| 任务 | 模型 | 输入 tokens | 输出 tokens | 单次模型成本 |
|---|---|---:|---:|---:|
| File Upload / Parse Summary | Terra | 4,000 | 800 | $0.0220 |
| Spreadsheet Assistant | Luna | 4,000 | 1,200 | $0.0112 |
| Pivot Builder | Terra | 6,000 | 1,500 | $0.0375 |
| Charts & Graphs | Terra | 8,000 | 2,000 | $0.0500 |
| Data Analysis | Terra | 12,000 | 3,000 | $0.0750 |
| Reports | Terra | 12,000 | 3,500 | $0.0825 |
| Complex Data Analysis | Sol | 12,000 | 3,000 | $0.1500 |
| Complex Reports | Sol | 12,000 | 3,500 | $0.1650 |

### Credit 校准逻辑

按上表折算后：

- `1 credit` 约对应 `$0.0104` 的模型成本
- 各任务的 credit 权重按“单次任务成本 / 0.0104”近似取整
- 因此，复杂分析和复杂报告必须使用更高权重，避免套餐被高成本任务打穿

### 当前套餐的模型毛利试算

按 `1 credit ≈ $0.0104` 估算：

| 套餐 | 价格 | 月度额度 | 满额模型成本 | 毛利 | 毛利率 |
|---|---:|---:|---:|---:|---:|
| Pro | $5.99 | 120 credits | $1.25 | $4.74 | 79.1% |
| Pro Plus | $11.99 | 300 credits | $3.12 | $8.87 | 74.0% |

说明：

- 以上仅计算模型 token 成本
- 未计入 Stripe、对象存储、数据库、日志、带宽、`code interpreter`、`file search` 等额外成本
- 因此真实净利润会低于表中毛利
- 但从模型成本角度看，当前 `Pro $5.99 / Pro Plus $11.99` 仍具备定价空间

### 参考来源

- OpenAI Models Compare
- GPT-5.6 Luna
- GPT-5.6 Terra
- GPT-5.6 Sol

## 8. 核心交互规范

- 所有工具页统一采用“左输入、右结果”布局。
- 所有生成页统一提供 `generate`、`reset`、`copy`。
- 所有解释页统一提供生成结果和说明。
- 所有结果页都要支持错误态、空态、加载态。
- 所有免费用户都要看到额度提示和升级入口。

## 9. 数据模型

### User

- id
- email
- name
- avatar
- plan
- createdAt

### Conversation

- id
- userId
- title
- createdAt
- updatedAt

### Message

- id
- conversationId
- role
- content
- createdAt

### UsageRecord

- id
- userId
- feature
- count
- periodStart
- periodEnd

### Subscription

- id
- userId
- plan
- status
- renewalAt

## 10. 接口建议

- `POST /api/assistant`
- `POST /api/pivot-builder`
- `POST /api/files/upload`
- `GET /api/files/:id/preview`
- `POST /api/data-analysis`
- `POST /api/charts`
- `POST /api/reports`
- `GET /api/usage`
- `GET /api/billing`
- `POST /api/subscribe`

## 11. 埋点与指标

### 核心指标

- 注册转化率
- 首次生成成功率
- 7 日留存
- 免费转付费率
- 工具页使用率

### 埋点事件

- view_dashboard
- start_assistant
- build_pivot
- upload_file
- run_analysis
- create_chart
- create_report
- upgrade_click
- billing_view
- usage_view

## 12. 风险与约束

- 生成结果可能不准确，必须声明仅供参考。
- 表格类输出需要支持导出和复制，否则价值会下降。
- 付费墙过早会影响激活，需保留足够免费额度。
- 工具页过多会增加维护成本，建议先做高频刚需。

## 13. 里程碑

### 第 1 阶段（2 周）

目标：打通登录、文件、助手三条主链路，并完成可演示的产品骨架。

#### 第 1 周

- 第 1 天：冻结页面路由、接口口径、环境变量、目录结构
- 交付：页面路由表、接口清单、环境变量清单、目录结构草案
- 验收：文档口径统一，前后端可按同一份清单开工
- 第 2 天：搭建 NestJS / Prisma / PostgreSQL / Redis 基础工程
- 交付：后端骨架、基础模块、数据库连接、迁移脚本
- 验收：服务可启动，能连通数据库与缓存
- 第 3 天：完成 Google / Microsoft OAuth 与 JWT httpOnly Cookie
- 交付：OAuth 登录、回调、用户绑定、Cookie 签发
- 验收：可完成第三方登录并返回当前用户
- 第 4 天：完成 `GET /api/auth/me`、`POST /api/auth/refresh`、`POST /api/auth/logout`
- 交付：鉴权接口、刷新接口、退出接口
- 验收：可恢复会话、可退出登录、401 可重试刷新
- 第 5 天：完成 Dashboard、Sidebar、QuotaCard 的基础框架
- 交付：登录后首页骨架、导航、额度展示、工具入口
- 验收：可进入核心页面，基础状态可见

#### 第 2 周

- 第 6 天：完成 Workbook 上传接口、文件校验、对象存储落盘
- 交付：上传表单、校验规则、上传 API、文件落盘
- 验收：可上传 Excel / CSV 并拿到 workbook id
- 第 7 天：完成 Workbook 解析、摘要、预览接口
- 交付：解析服务、sheet 摘要、预览 API
- 验收：可看到 sheet、表头、样例行和摘要
- 第 8 天：完成 Spreadsheet Assistant 会话模型与消息存储
- 交付：会话表、消息表、会话列表接口、新建会话接口
- 验收：可创建、切换、保存历史会话
- 第 9 天：完成 Spreadsheet Assistant SSE 流式响应
- 交付：流式接口、前端增量渲染、消息落库
- 验收：回答可边生成边显示，结束后可回放
- 第 10 天：完成端到端联调、错误态、基础埋点与修复
- 交付：端到端联调、空态/错误态、基础埋点、修复清单
- 验收：登录、上传、对话三条链路可稳定演示

#### 第 1 阶段验收

- 可完成第三方登录并恢复会话
- 可上传并预览 Excel / CSV
- 可在 Assistant 中看到流式输出
- 可在 Dashboard 看到入口、额度和基础状态
- 可进入下一阶段的 Pivot / Analysis / Charts / Reports 开发
