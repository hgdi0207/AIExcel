# AI Excel 工具平台 — 页面原型说明书 V2

版本：V2.0  
日期：2026-08-09  
关联 PRD：[gptexcel-prd.md](./gptexcel-prd.md)  
范围：P0 全量页面

---

## 0. 全局框架

### 0.1 整体布局

三区结构（登录后所有页通用）：

```
┌──────────────────────────────────────────────┐
│  TopBar（56px 高，固定）                       │
├──────────┬───────────────────────────────────┤
│          │                                   │
│ Sidebar  │        主内容区                    │
│ (240px)  │        (flex 1，可滚动)            │
│          │                                   │
└──────────┴───────────────────────────────────┘
```

### 0.2 TopBar

| 位置 | 元素 |
|------|------|
| 左侧 | Logo（24px）+ 产品名文字 |
| 右侧 | 通知铃铛 icon、用户头像（点击展开下拉菜单） |

用户头像下拉菜单：Account Settings / Billing / Sign Out

### 0.3 Sidebar

```
Dashboard
─────────────
Pivot Builder
Spreadsheet Assistant
Data Analysis
Charts & Graphs
Reports
─────────────
Billing
Usage History
```

底部固定区域（免费用户）：
- 配额进度条：`Tool uses: 2/4 today`
- `Upgrade to Pro` 按钮（紫色，全宽）
- `Send Feedback` 文字链接

Pro 用户底部只显示 `Send Feedback`，不显示进度条和升级按钮。

### 0.4 全局状态规范

| 状态 | 实现方式 |
|------|---------|
| 加载中 | 骨架屏（shimmer 动画） |
| 空态 | 居中插画 + 主提示文字 + 次级说明 |
| 错误态 | 结果区顶部红色 Banner + 重试按钮 |
| 成功态 | 右上角绿色 Toast，3 秒消失 |
| 配额耗尽 | 弹出 QuotaModal（见附录 B） |

---

## 1. 登录页

### 1.1 页面路由

| 路由 | 说明 |
|------|------|
| `/login` | 唯一登录入口 |
| `/auth/callback` | OAuth 授权回调，处理后跳转 `/dashboard` |

> 账号体系仅支持 Google 和 Microsoft OAuth，无邮箱密码登录，无找回密码流程。首次登录自动完成注册。

### 1.2 布局

```
┌─────────────────────────────────────────────┐
│  [Logo + 产品名]（页面顶部居中，48px margin）  │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Welcome to [产品名]                  │   │
│  │  Sign in or create your account     │   │
│  │                                     │   │
│  │  [G]  Continue with Google          │   │
│  │                                     │   │
│  │  [⊞]  Continue with Microsoft       │   │
│  │                                     │   │
│  │  ─────────────────────────────────  │   │
│  │  By continuing, you agree to our    │   │
│  │  Terms of Service & Privacy Policy  │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 1.3 交互规范

- 点击 OAuth 按钮：跳转对应平台授权页
- 授权成功后回调 `/auth/callback`，完成用户创建/识别后跳转 `/dashboard`
- 授权失败或用户取消：返回 `/login`，卡片顶部显示红色提示条 `Authorization failed. Please try again.`
- 按钮等待回调期间显示 loading spinner + disabled，防止重复点击
- 已登录用户访问 `/login` 直接重定向到 `/dashboard`

---

## 2. Dashboard 页

### 2.1 页面目标

作为产品主入口，让用户一眼找到想用的工具，并感知升级价值。

### 2.2 布局结构

```
┌────────────────────────────────────────────────┐
│  Welcome back, [Name]  ·  [当前套餐标签]          │
│  What would you like to do today?              │
├────────────────────────────────────────────────┤
│  工具卡片区（2 列 grid，响应式）                   │
│                                                │
│  ┌─────────────────┐  ┌─────────────────┐      │
│  │  Spreadsheet    │  │  Pivot Builder  │      │
│  │  Assistant      │  │  [icon]         │      │
│  │  [icon]         │  │  Build pivot    │      │
│  │  Chat with AI   │  │  tables with AI │      │
│  └─────────────────┘  └─────────────────┘      │
│                                                │
│  ┌─────────────────┐  ┌─────────────────┐      │
│  │  Data Analysis  │  │ Charts & Graphs │      │
│  │  [icon]         │  │  [icon]         │      │
│  │  Analyze trends │  │  Visualize data │      │
│  └─────────────────┘  └─────────────────┘      │
│                                                │
│  ┌─────────────────┐                           │
│  │    Reports      │                           │
│  │    [icon]       │                           │
│  │  Generate docs  │                           │
│  └─────────────────┘                           │
├────────────────────────────────────────────────┤
│  今日用量  Chat: 2/10  Tools: 1/4  [进度条]      │
│  [Upgrade to Pro →]                            │
└────────────────────────────────────────────────┘
```

### 2.3 工具卡片规范

- 尺寸：宽度自适应，最小 200px，高度 120px
- 内容：大图标（32px）+ 工具名（加粗）+ 一句话描述
- 悬停效果：边框高亮（主色）+ 轻微上移阴影
- 点击：跳转对应工具页

### 2.4 用量条规范

- 免费用户：显示 Chat 和 Tools 两条进度条
- 进度 ≥ 80%：进度条变橙色
- 进度 = 100%：进度条变红色 + `Limit reached`
- Pro 用户：隐藏进度条，显示 `Pro plan · Unlimited` 绿色标签

---

## 3. Spreadsheet Assistant 页

### 3.1 页面目标

以对话形式承接复杂表格问题，是平台的核心智能入口。

### 3.2 布局结构

```
┌────────────────┬──────────────────────────────────┐
│  会话侧边栏     │  对话主区域                        │
│  (260px)       │                                  │
│                │  ┌────────────────────────────┐  │
│  [+ New Chat]  │  │  空态：示例提示词 6 个卡片    │  │
│                │  └────────────────────────────┘  │
│  Today         │                                  │
│  > Analyze Q3  │  消息气泡区域（可滚动）             │
│  > Pivot table │  · 用户消息：右对齐，主色背景       │
│                │  · AI 消息：左对齐，白色背景        │
│  Yesterday     │    含代码块高亮 + 复制按钮          │
│  > Format macro│                                  │
│                ├──────────────────────────────────┤
│  [清空历史]     │  输入区（固定底部）                 │
│                │  [📎 上传文件]  [textarea]  [↑]   │
│                │  快捷：Pivot  Analysis  Chart     │
└────────────────┴──────────────────────────────────┘
```

### 3.3 示例提示词卡片（空态，6 张，2 列 3 行）

- "Analyze my sales data and find the top 5 products"
- "Build a pivot table to compare revenue by region"
- "Explain what this formula does: =SUMIFS(...)"
- "Create a monthly report summary from this dataset"
- "What chart type fits this trend data best?"
- "Find anomalies in my inventory sheet"

点击后自动填入输入框并发送。

### 3.4 消息气泡规范

| 角色 | 对齐 | 背景色 | 最大宽度 |
|------|------|--------|---------|
| 用户 | 右对齐 | 主色蓝 | 70% |
| AI | 左对齐 | 白色/浅灰 | 85% |

AI 消息内代码块：深色背景（#1e1e1e）+ 语言标签 + `Copy` 按钮。

### 3.5 输入区规范

- 📎 上传文件按钮：触发文件选择（Excel / CSV），上传后显示文件名 chip
- Textarea：`Shift+Enter` 换行，`Enter` 发送；最小 1 行，最大 6 行，自动撑高
- 发送中：按钮变 loading，输入框 disabled
- 快捷按钮点击后在输入框前追加语境前缀（`[Pivot]` / `[Analysis]` / `[Chart]`）

### 3.6 会话管理

- 历史会话标题：取第一条消息前 30 字符截断
- 清空历史：点击后弹出二次确认 Modal，确认后清除当前会话所有消息

---

## 4. Workbook Ingestion 页

### 4.1 页面目标

将上传的 Excel / CSV 解析为结构化中间表示，供 Assistant、Analysis、Charts、Reports 复用。

### 4.2 布局结构

```
┌─────────────────────────────────────────────────┐
│  Upload Your File                               │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │                                         │   │
│  │   📂  Drag & drop or click to upload    │   │
│  │   Supports .xlsx, .xls, .csv            │   │
│  │                                         │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ── 上传成功后展示解析结果 ───────────────────────  │
│                                                 │
│  File: sales_2026.xlsx  · 3 sheets · 1,240 rows │
│                                                 │
│  Sheet 选择 Tab：[Sheet1 ▼] [Sheet2] [Sheet3]   │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ 表头预览（前 5 行，列宽自适应）              │  │
│  │ ┌──────┬────────┬──────────┬──────────┐  │  │
│  │ │ Date │ Region │ Product  │ Revenue  │  │  │
│  │ ├──────┼────────┼──────────┼──────────┤  │  │
│  │ │ Jan  │ North  │ Widget A │  12,000  │  │  │
│  │ │ Jan  │ South  │ Widget B │   8,400  │  │  │
│  │ │ ...  │        │          │          │  │  │
│  │ └──────┴────────┴──────────┴──────────┘  │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  摘要卡片（自动生成）                             │
│  · 4 columns detected: Date, Region, ...       │
│  · Date range: Jan 2026 – Jun 2026             │
│  · No formula columns detected                 │
│                                                 │
│  [Use in Assistant →]  [Analyze →]  [Chart →]  │
└─────────────────────────────────────────────────┘
```

### 4.3 交互规范

- 拖拽或点击上传区均可触发文件选择
- 上传中：上传区显示进度条（文件名 + 百分比）
- 解析失败：上传区变红色边框 + 错误说明（`Could not parse file. Please check the format.`）
- 支持重新上传：点击文件名旁 `×` 清除，恢复上传区
- `Use in Assistant →`：跳转 Spreadsheet Assistant 并将文件上下文注入当前会话
- `Analyze →`：跳转 Data Analysis 并预填文件
- `Chart →`：跳转 Charts & Graphs 并预填文件

---

## 5. Pivot Builder 页

### 5.1 页面目标

根据数据源和分析目标生成透视表结构与字段配置建议。

### 5.2 布局结构（左配置 · 右预览）

```
┌──────────────────────┬────────────────────────────┐
│  左：配置区           │  右：预览区                  │
│                      │                            │
│  数据源               │  Pivot Preview             │
│  [选择已上传文件 ▼]   │                            │
│  或 [上传新文件]       │  ┌──────┬───────┬───────┐ │
│                      │  │      │ North │ South │ │
│  Sheet               │  ├──────┼───────┼───────┤ │
│  [Sheet1 ▼]          │  │ Q1   │12,000 │ 8,400 │ │
│                      │  │ Q2   │15,200 │ 9,100 │ │
│  分析目标（自然语言）   │  └──────┴───────┴───────┘ │
│  ┌──────────────────┐│                            │
│  │ Compare revenue  ││  字段映射说明                │
│  │ by region and    ││  Rows: Quarter             │
│  │ quarter          ││  Columns: Region           │
│  └──────────────────┘│  Values: SUM(Revenue)      │
│                      │  Filters: —                │
│  字段配置（AI 建议）   │                            │
│  Rows    [Quarter ▼] │  [Copy Config]             │
│  Columns [Region ▼]  │  [Try in Assistant →]      │
│  Values  [Revenue ▼] │                            │
│  Filters [— ▼]       │                            │
│                      │                            │
│  [Generate Pivot]    │                            │
│  [Reset]             │                            │
└──────────────────────┴────────────────────────────┘
```

### 5.3 交互规范

- 选择文件后字段下拉列表自动从文件表头填充
- 点击 `Generate Pivot`：AI 根据自然语言描述自动推荐行 / 列 / 值 / 筛选字段，用户可手动覆盖
- 字段变更后预览区实时刷新（防抖 500ms）
- `Copy Config`：将字段配置以 JSON 格式复制到剪贴板
- 数据行超过 5 行时预览区显示 `Showing 5 of N rows`

---

## 6. Data Analysis 页

### 6.1 页面目标

对上传数据进行趋势、异常、汇总和洞察分析，输出结构化分析结果。

### 6.2 布局结构（上输入 · 下结果）

```
┌─────────────────────────────────────────────────┐
│  Data Analysis                                  │
│                                                 │
│  数据源                                          │
│  [选择已上传文件 ▼]  或  [上传新文件]               │
│  Sheet: [Sheet1 ▼]                              │
│                                                 │
│  分析目标（可选，留空则自动全量分析）                 │
│  ┌───────────────────────────────────────────┐  │
│  │ e.g. "Find sales trends and outliers"     │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  [Analyze]    [Reset]                           │
│                                                 │
│  ══════════════ 分析结果区 ══════════════════════ │
│                                                 │
│  📊 Summary                                     │
│  · 1,240 rows · 4 columns · Date range: 6 mo   │
│  · Total Revenue: $842,300                      │
│                                                 │
│  📈 Trends                                      │
│  · Revenue grew 18% from Q1 to Q2              │
│  · North region outperforms South by 32%       │
│                                                 │
│  ⚠️  Anomalies                                  │
│  · Row 142: Revenue = $0 (possible missing data)│
│  · Row 389: Date format inconsistency           │
│                                                 │
│  💡 Insights                                    │
│  · Widget A drives 61% of total revenue        │
│  · June shows a seasonal dip across all regions│
│                                                 │
│  [Copy Report]  [Send to Reports →]             │
│  [Try in Assistant →]                           │
└─────────────────────────────────────────────────┘
```

### 6.3 交互规范

- 结果区各模块（Summary / Trends / Anomalies / Insights）分卡片展示，可折叠
- 异常值条目可点击，点击后高亮说明（行号 + 问题描述 + 建议操作）
- `Copy Report`：将分析摘要以 Markdown 格式复制到剪贴板
- `Send to Reports →`：将分析结果预填到 Reports 页
- 加载中：结果区显示各模块骨架屏，顺序渐入

---

## 7. Charts & Graphs 页

### 7.1 页面目标

根据数据和目标推荐图表类型，输出可复用的图表配置。

### 7.2 布局结构（左配置 · 右预览）

```
┌──────────────────────┬────────────────────────────┐
│  左：配置区           │  右：图表预览                │
│                      │                            │
│  数据源               │  ┌────────────────────┐   │
│  [选择已上传文件 ▼]   │  │                    │   │
│  Sheet: [Sheet1 ▼]   │  │   [图表渲染区域]     │   │
│                      │  │   (Bar / Line /    │   │
│  可视化目标（自然语言）│  │    Pie 等)          │   │
│  ┌──────────────────┐│  │                    │   │
│  │ Show revenue     ││  └────────────────────┘   │
│  │ trend by month   ││                            │
│  └──────────────────┘│  AI 推荐说明                │
│                      │  "Line chart fits best for │
│  图表类型（AI 推荐）   │  time-series trend data."  │
│  ● Line  ○ Bar       │                            │
│  ○ Pie   ○ Scatter   │  图表配置摘要               │
│                      │  X-Axis: Month             │
│  X 轴  [Month ▼]     │  Y-Axis: Revenue           │
│  Y 轴  [Revenue ▼]   │  Title: Revenue by Month   │
│  颜色  [默认 ▼]       │                            │
│  标题  [___________] │  [Copy Config]             │
│                      │  [Download SVG]            │
│  [Generate Chart]    │  [Try in Assistant →]      │
│  [Reset]             │                            │
└──────────────────────┴────────────────────────────┘
```

### 7.3 交互规范

- 选择文件后 X轴/Y轴下拉自动从表头填充
- 点击 `Generate Chart`：AI 根据目标推荐图表类型并自动选中，用户可手动切换
- 图表类型切换后预览区即时刷新（不需要重新点 Generate）
- `Copy Config`：复制 JSON 格式图表配置（兼容 ECharts / Chart.js）
- `Download SVG`：下载当前预览为 SVG 文件（Pro 功能，免费用户点击触发升级提示）

---

## 8. Reports 页

### 8.1 页面目标

将分析结果整理成结构完整、可直接使用的报告，并支持多格式导出。

### 8.2 布局结构（左配置 · 右预览）

```
┌──────────────────────┬────────────────────────────┐
│  左：配置区           │  右：报告预览                │
│                      │                            │
│  报告标题             │  ┌────────────────────┐   │
│  [_______________]   │  │ # Q2 Sales Report  │   │
│                      │  │                    │   │
│  数据来源（可选）       │  │ ## Summary         │   │
│  [选择分析结果 ▼]      │  │ Revenue grew 18%.. │   │
│  或 [上传新文件]       │  │                    │   │
│                      │  │ ## Key Findings    │   │
│  报告目标描述          │  │ · Widget A leads.. │   │
│  ┌──────────────────┐│  │ · June dip noted.. │   │
│  │ Create a Q2 sales ││  │                    │   │
│  │ summary for mgmt ││  │ ## Recommendations │   │
│  └──────────────────┘│  │ · Focus on North.. │   │
│                      │  └────────────────────┘   │
│  包含模块（多选）       │                            │
│  ☑ Summary           │  [Copy Markdown]           │
│  ☑ Key Findings      │  [Download DOCX]           │
│  ☑ Recommendations   │  [Download PDF]            │
│  ☐ Raw Data Table    │  [Try in Assistant →]      │
│                      │                            │
│  [Generate Report]   │                            │
│  [Reset]             │                            │
└──────────────────────┴────────────────────────────┘
```

### 8.3 交互规范

- 选择分析结果后，报告标题和目标描述自动预填（可修改）
- 包含模块勾选状态变更后不自动重生成，点 `Generate Report` 后统一刷新
- 右侧预览为 Markdown 渲染视图，支持内部滚动
- `Copy Markdown`：复制 Markdown 原文
- `Download DOCX` / `Download PDF`：Pro 功能，免费用户点击触发 QuotaModal

---

## 9. Billing 页

### 9.1 页面目标

让用户清晰了解当前套餐状态，并顺滑完成升级。

### 9.2 布局结构

```
┌────────────────────────────────────────────────────┐
│  Current Plan                                      │
│                                                    │
│  ┌──────────────────┐  ┌────────────────────────┐  │
│  │  FREE            │  │  PRO                   │  │
│  │  $0 / month      │  │  $6.99 / month         │  │
│  │                  │  │  $62.91 / year (−25%)  │  │
│  │  ✓ 10 chats/mo   │  │  ✓ Unlimited chats     │  │
│  │  ✓ 4 tools/12h   │  │  ✓ Unlimited tools     │  │
│  │  ✗ File export   │  │  ✓ File export         │  │
│  │  ✗ DOCX/PDF      │  │  ✓ DOCX/PDF download   │  │
│  │  ✗ SVG download  │  │  ✓ SVG download        │  │
│  │                  │  │                        │  │
│  │  [Current Plan]  │  │  [Upgrade to Pro →]    │  │
│  │  （灰色不可点）    │  │  （主色按钮）            │  │
│  └──────────────────┘  └────────────────────────┘  │
│                                                    │
│  月付 / 年付 Toggle（置于 PRO 卡片顶部）              │
│                                                    │
│  ──────────────────────────────────────────────── │
│  Usage This Period                                 │
│  AI Chat    ████████░░  8 / 10 messages            │
│  Tool uses  ███░░░░░░░  2 / 4 per 12h              │
│                                                    │
│  ──────────────────────────────────────────────── │
│  Payment Method  （Pro 用户可见）                   │
│  Visa ending in 4242   [Manage →]                 │
│  Next renewal: 2026-09-06   [Cancel Plan]         │
└────────────────────────────────────────────────────┘
```

### 9.3 交互规范

- 月付/年付 Toggle 切换时 PRO 卡片价格即时更新，无需刷新
- `Upgrade to Pro →`：跳转 Stripe Checkout（新 Tab）
- `Manage →`：跳转 Stripe 客户门户
- `Cancel Plan`：弹出确认 Modal，含取消后权益说明，确认后调用取消接口
- Pro 用户：Free 卡片置灰，Pro 卡片右上角显示 `Current Plan` 绿色徽章

---

## 10. Usage History 页

### 10.1 页面目标

让用户感知自己的活跃情况，辅助免费用户决策升级。

### 10.2 布局结构

```
┌────────────────────────────────────────────────────┐
│  Usage Overview · This Week                        │
│  [← 上周]                          [本周 →]        │
│                                                    │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌─────────┐  │
│  │  24    │  │  10    │  │  14    │  │    3    │  │
│  │ Total  │  │ Chats  │  │ Tools  │  │ Shared  │  │
│  └────────┘  └────────┘  └────────┘  └─────────┘  │
│                                                    │
│  活动柱状图（按天，7 根柱子）                          │
│  Mon  Tue  Wed  Thu  Fri  Sat  Sun                 │
│   █    ██   █   ███   █    ░    ░                  │
│                                                    │
│  ──────────────────────────────────────────────── │
│  Tool Breakdown                                    │
│  Spreadsheet Assistant  ████████░░  10 uses        │
│  Data Analysis          █████░░░░░   7 uses        │
│  Pivot Builder          ████░░░░░░   5 uses        │
│  Charts & Graphs        ██░░░░░░░░   2 uses        │
│  Reports                █░░░░░░░░░   1 use         │
│                                                    │
│  ──────────────────────────────────────────────── │
│  [免费用户升级提示 Banner（用量 ≥ 70% 时出现）]        │
│  You've used 80% of your monthly quota.            │
│  Upgrade to Pro for unlimited access. [Upgrade →] │
└────────────────────────────────────────────────────┘
```

### 10.3 交互规范

- 周切换：点击箭头切换统计周期，`本周 →` 在当前周时置灰不可点
- 柱状图悬停：Tooltip 显示该天各工具使用次数明细
- 升级提示 Banner：用量 ≥ 70% 黄色，≥ 90% 橙色，= 100% 红色
- Pro 用户：隐藏升级 Banner，Tool Breakdown 列表照常显示

---

## 附录 A：工具页通用交互规范

| 规范项 | 说明 |
|--------|------|
| 布局 | 左输入/配置（40%）· 右结果/预览（60%），1024px 以下堆叠为上下布局 |
| 必备按钮 | Generate（主色）/ Reset（白底灰边）/ Copy（结果区右上角） |
| 加载中 | Generate 按钮变 `Generating...` + spinner，右侧显示骨架屏 |
| 空态 | 右侧居中插图 + 提示文字，无额外操作 |
| 复制成功 | 按钮变 `Copied ✓` 持续 2 秒后复原 |
| Try in Assistant | 所有工具结果区提供此入口，跳转 Spreadsheet Assistant 并带入上下文 |
| Pro 专属功能 | 标注 `Pro` 徽章，点击触发 QuotaModal 而非报错 |

---

## 附录 B：QuotaModal（配额耗尽弹窗）

触发条件：免费用户调用 API 时额度已耗尽，或点击 Pro 专属功能。

```
┌─────────────────────────────────────────┐
│  You've reached your limit              │
│                                         │
│  Free plan includes:                    │
│  · 10 AI chat messages / month          │
│  · 4 tool uses every 12 hours           │
│                                         │
│  Your quota resets in: 8h 24m           │
│                                         │
│  [Upgrade to Pro — $6.99/mo]  （主色）   │
│  [Wait for reset]             （文字链）  │
└─────────────────────────────────────────┘
```

- 背景遮罩：`rgba(0,0,0,0.5)`，不可点击遮罩关闭（强引导）
- 仅 `Wait for reset` 可关闭弹窗

---

## 附录 C：响应式断点

| 断点 | 适配策略 |
|------|---------|
| ≥ 1280px | 标准三区布局 |
| 1024px–1279px | Sidebar 折叠为 icon-only（宽度收缩至 60px） |
| 768px–1023px | 工具页改为上下布局（配置在上，结果在下） |
| < 768px | Sidebar 变为底部 Tab Bar，工具页全宽单列 |
