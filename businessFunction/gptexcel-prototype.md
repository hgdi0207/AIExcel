# AI Excel 工具平台 — 页面原型说明书

版本：V1.0  
日期：2026-08-06  
关联 PRD：[gptexcel-prd.md](./gptexcel-prd.md)

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
AI Chat
Formulas
Scripts
SQL
Regex
──────────
Template  [NEW]
──────────
Billing
Usage History
```

底部固定区域（免费用户）：
- 配额进度条：`Tool uses: 2/4 today`
- `Upgrade to Pro` 按钮（紫色，全宽）
- `Send Feedback` 文字链接

### 0.4 全局状态规范

| 状态 | 实现方式 |
|------|---------|
| 加载中 | 骨架屏（shimmer 动画） |
| 空态 | 居中插画 + 主提示文字 + 次级说明 |
| 错误态 | 结果区顶部红色 Banner + 重试按钮 |
| 成功态 | 右上角绿色 Toast，3 秒消失 |
| 配额耗尽 | 弹出 QuotaModal（见附录 B） |

---

## 1. 登录 / 注册页

### 1.1 页面路由

| 路由 | 页面 |
|------|------|
| `/login` | 登录 / 注册（合一） |

> 账号体系仅支持 Google 和 Microsoft OAuth，无邮箱密码登录，无找回密码流程。

### 1.2 登录页布局

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

- 点击任一 OAuth 按钮：跳转对应平台授权页（新窗口或当前页跳转）
- 授权成功后回调到 `/dashboard`
- 授权失败或用户取消：返回 `/login` 并在卡片顶部显示红色提示条（`Authorization failed. Please try again.`）
- 首次登录自动完成注册，无需额外填写字段
- 按钮在等待 OAuth 回调期间显示 loading spinner 并 disabled，防止重复点击

---

## 2. Dashboard 页

### 2.1 页面目标

作为产品主入口，让用户一眼找到想用的工具，并感知升级价值。

### 2.2 布局结构

```
┌────────────────────────────────────────────────┐
│  Welcome back, [Name]  ·  [当前套餐标签]          │
│  [副标题：What would you like to create today?] │
├────────────────────────────────────────────────┤
│  工具卡片区（2列 grid，响应式）                    │
│                                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ Formulas │  │ Scripts  │  │   SQL    │     │
│  │ [icon]   │  │ [icon]   │  │ [icon]   │     │
│  │ 生成/解释 │  │ VBA/Apps │  │ 查询生成  │     │
│  └──────────┘  └──────────┘  └──────────┘     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │  Regex   │  │ Template │  │ AI Chat  │     │
│  │ [icon]   │  │ [NEW]    │  │ [icon]   │     │
│  │ 正则生成  │  │ 模板生成  │  │ 智能助手  │     │
│  └──────────┘  └──────────┘  └──────────┘     │
├────────────────────────────────────────────────┤
│  今日用量  [进度条]  Chat: 2/10  Tools: 1/4     │
│  [Upgrade to Pro →]                            │
└────────────────────────────────────────────────┘
```

### 2.3 工具卡片规范

- 尺寸：宽度自适应，最小 180px，高度 120px
- 内容：大图标（32px）+ 工具名（加粗）+ 一句话描述
- 悬停效果：边框高亮（主色）+ 轻微上移阴影
- 新功能标记：右上角橙色 `NEW` 标签（Template）
- 点击：跳转对应工具页

### 2.4 用量条规范

- 免费用户：显示 Chat 和 Tools 两条进度条
- 当进度 ≥ 80%：进度条变橙色
- 当进度 = 100%：进度条变红色 + `Limit reached` 文字
- Pro 用户：隐藏进度条，显示 `Pro plan · Unlimited` 绿色标签

---

## 3. AI Chat 页

### 3.1 页面目标

承接复杂的、不确定工具分类的问题，提供对话式 AI 体验。

### 3.2 布局结构

```
┌────────────────┬──────────────────────────────────┐
│  会话侧边栏     │  对话主区域                        │
│  (260px)       │                                  │
│                │  ┌────────────────────────────┐  │
│  [+ New Chat]  │  │  [空态：示例提示词 6个卡片]  │  │
│                │  └────────────────────────────┘  │
│  Today         │                                  │
│  > 如何用 VLOOKUP│  消息气泡区域（可滚动）            │
│  > 帮我写一个宏  │  - 用户消息：右对齐，蓝色背景      │
│                │  - AI 消息：左对齐，白色背景        │
│  Yesterday     │    含代码块高亮、复制按钮           │
│  > SQL 联表查询  │                                  │
│                ├──────────────────────────────────┤
│                │  输入区（固定底部）                  │
│  [清空历史]     │  [textarea] [Send ↑]             │
│                │  快捷工具：Formula SQL Script Regex│
└────────────────┴──────────────────────────────────┘
```

### 3.3 示例提示词卡片（空态）

6 张卡片，2 列 3 行，内容示例：
- "Generate a VLOOKUP formula to match employee IDs"
- "Write a VBA macro to auto-format a report"
- "Explain this SQL query: SELECT ..."
- "Create a regex to validate email addresses"
- "Build a monthly sales summary template"
- "How do I use SUMIFS with multiple conditions?"

点击后自动填入输入框并发送。

### 3.4 消息气泡规范

| 角色 | 对齐 | 背景色 | 最大宽度 |
|------|------|--------|---------|
| 用户 | 右对齐 | 主色蓝 | 70% |
| AI | 左对齐 | 白色/浅灰 | 85% |

AI 消息中的代码块：
- 深色背景（#1e1e1e）
- 右上角显示语言标签（excel / sql / vba 等）
- 右上角 `Copy` 按钮

### 3.5 输入区规范

- Textarea 最小 1 行，最大 6 行，自动撑高
- `Shift+Enter` 换行，`Enter` 发送
- 发送中：Send 按钮变 loading，输入框 disabled
- 快捷工具按钮点击后在输入框前追加上下文前缀（如 `[Formula]`）

### 3.6 会话管理

- 新建会话：点击 `+ New Chat`，清空消息区，显示示例卡片
- 历史会话：标题取第一条消息前 30 字符截断
- 清空历史：底部文字链接，点击弹出二次确认 Modal

---

## 4. Formulas 页

### 4.1 页面目标

生成或解释 Excel / Sheets / Airtable 公式。

### 4.2 布局结构（左输入 · 右结果）

```
┌──────────────────────┬───────────────────────────┐
│  左：输入区           │  右：结果区                 │
│                      │                           │
│  平台选择             │  [空态 or 结果内容]          │
│  ● Excel             │                           │
│  ○ Google Sheets     │  ┌───────────────────────┐│
│  ○ Airtable          │  │  =VLOOKUP(A2,          ││
│                      │  │    Sheet2!A:B, 2, 0)   ││
│  模式切换             │  └───────────────────────┘│
│  [Generate] [Explain]│                           │
│                      │  解释文字（Explain 模式）    │
│  ┌──────────────────┐│  This formula looks up... ││
│  │ Describe what you ││                           │
│  │ need in plain     ││  [Copy]  [Try in Chat →] │
│  │ English...        ││                           │
│  └──────────────────┘│                           │
│                      │                           │
│  [Generate Formula]  │                           │
│  [Reset]             │                           │
└──────────────────────┴───────────────────────────┘
```

### 4.3 交互规范

- **Generate 模式**：输入需求描述 → 点击 Generate → 右侧输出公式代码块
- **Explain 模式**：输入已有公式 → 点击 Explain → 右侧输出逐段说明
- 模式切换时清空输入和结果
- `Try in Chat →` 将当前公式和描述拼接发送到 AI Chat

### 4.4 结果区代码块规范

- 背景色：深色（#1e1e1e）
- 字体：monospace，14px
- 语法高亮：函数名高亮蓝色，字符串橙色
- 右上角：语言标签 `excel` + `Copy` 按钮

### 4.5 空态

插图 + 文字：`Describe what you need and we'll generate the formula`

---

## 5. Scripts 页

### 5.1 页面目标

生成或解释 VBA / Google Apps Script 自动化脚本。

### 5.2 布局结构（与 Formulas 相同框架）

```
┌──────────────────────┬───────────────────────────┐
│  左：输入区           │  右：结果区                 │
│                      │                           │
│  脚本类型             │  代码块（多行）              │
│  ● VBA               │  ┌───────────────────────┐│
│  ○ Apps Script       │  │Sub FormatReport()     ││
│                      │  │  Dim ws As Worksheet  ││
│  模式切换             │  │  ...                  ││
│  [Generate] [Explain]│  └───────────────────────┘│
│                      │                           │
│  [Textarea]          │  说明文字（Explain 模式）    │
│                      │                           │
│  [Generate Script]   │  [Copy] [Try in Chat →]  │
│  [Reset]             │                           │
└──────────────────────┴───────────────────────────┘
```

### 5.3 交互规范

- VBA 代码块标注 `vba` 语言，Apps Script 标注 `javascript`
- Explain 模式：逐函数 / 逐段解释，用编号列表呈现
- 结果较长时右侧区域内部滚动（max-height: 60vh）

---

## 6. SQL 页

### 6.1 页面目标

生成或解释 SQL 查询语句。

### 6.2 布局结构

```
┌──────────────────────┬───────────────────────────┐
│  左：输入区           │  右：结果区                 │
│                      │                           │
│  数据库类型           │  代码块                    │
│  ● MySQL             │  ┌───────────────────────┐│
│  ○ PostgreSQL        │  │SELECT u.name,         ││
│  ○ SQLite            │  │  COUNT(o.id) AS orders ││
│  ○ BigQuery          │  │FROM users u            ││
│  ○ SQL Server        │  │JOIN orders o ON ...   ││
│                      │  └───────────────────────┘│
│  模式切换             │                           │
│  [Generate] [Explain]│  [Copy] [Try in Chat →]  │
│                      │                           │
│  表结构 / 需求描述     │                           │
│  [Textarea]          │                           │
│                      │                           │
│  [Generate SQL]      │                           │
│  [Reset]             │                           │
└──────────────────────┴───────────────────────────┘
```

### 6.3 输入区说明

输入框上方有折叠提示：`Tip: Describe your table structure for better results`  
示例提示文字（placeholder）：
> "I have a users table (id, name, email) and orders table (id, user_id, amount, date). Show me the top 10 users by total orders in the last 30 days."

---

## 7. Regex 页

### 7.1 页面目标

生成或解释正则表达式。

### 7.2 布局结构

```
┌──────────────────────┬───────────────────────────┐
│  左：输入区           │  右：结果区                 │
│                      │                           │
│  模式切换             │  正则表达式（大字体代码块）   │
│  [Generate] [Explain]│                           │
│                      │  ^[\w.-]+@[\w.-]+\.\w+$   │
│  [Textarea]          │                           │
│  "Match valid email  │  ────────────────────     │
│   addresses"         │  逐段解释（Explain 模式）   │
│                      │  ^ : Start of string      │
│  [Generate Regex]    │  [\w.-] : word char...    │
│  [Reset]             │                           │
│                      │  [Copy] [Try in Chat →]  │
└──────────────────────┴───────────────────────────┘
```

### 7.3 特殊规范

- Generate 结果：大字号（18px monospace）+ 背景深色块，方便用户直接选取
- Explain 结果：逐片段分行解释，每行格式 `片段 : 含义说明`

---

## 8. Template 页（P1）

### 8.1 页面目标

根据描述生成可下载的电子表格模板。

### 8.2 布局结构

```
┌──────────────────────┬───────────────────────────┐
│  左：配置区           │  右：预览区                 │
│                      │                           │
│  模板名称             │  表格预览（类电子表格样式）   │
│  [_______________]   │                           │
│                      │  ┌──┬──────┬───────┬────┐ │
│  需求描述             │  │  │  A   │   B   │ C  │ │
│  [Textarea]          │  ├──┼──────┼───────┼────┤ │
│                      │  │1 │Month │Revenue│Cost│ │
│  行数                 │  ├──┼──────┼───────┼────┤ │
│  [10 ▼]              │  │2 │Jan   │       │    │ │
│                      │  │3 │Feb   │       │    │ │
│  包含示例公式？        │  └──┴──────┴───────┴────┘ │
│  ● Yes  ○ No         │                           │
│                      │  [Download .xlsx]         │
│  [Generate Template] │  [Download .csv]          │
│  [Reset]             │  [Try in Chat →]          │
└──────────────────────┴───────────────────────────┘
```

### 8.3 预览区规范

- 仅展示表头 + 前 5 行，其余截断并显示 `...and X more rows`
- 表格单元格样式：表头行加粗 + 浅灰背景
- 含公式的单元格：显示公式字符串（不求值）

---

## 9. Billing 页

### 9.1 页面目标

让用户清晰了解当前套餐状态，并顺滑完成升级。

### 9.2 布局结构

```
┌───────────────────────────────────────────────────┐
│  Current Plan                                     │
│                                                   │
│  ┌────────────────────┐  ┌──────────────────────┐ │
│  │  FREE              │  │  PRO                 │ │
│  │  $0 / month        │  │  $6.99 / month       │ │
│  │                    │  │  $62.91 / year (-25%)│ │
│  │  ✓ 10 AI chats/mo  │  │  ✓ Unlimited chats   │ │
│  │  ✓ 4 tools / 12h   │  │  ✓ Unlimited tools   │ │
│  │  ✗ Priority AI     │  │  ✓ Priority AI       │ │
│  │  ✗ File upload     │  │  ✓ File upload       │ │
│  │                    │  │                      │ │
│  │  [Current Plan]    │  │  [Upgrade to Pro →]  │ │
│  │  (灰色，不可点)      │  │  (主色按钮)           │ │
│  └────────────────────┘  └──────────────────────┘ │
│                                                   │
│  ─────────────────────────────────────────────── │
│  Usage This Period                                │
│  AI Chat   ████████░░  8/10 messages              │
│  Tool uses ███░░░░░░░  2/4 per 12h               │
│                                                   │
│  ─────────────────────────────────────────────── │
│  Payment Method  （Pro 用户可见）                  │
│  Visa ending in 4242  [Manage →]                 │
│                                                   │
│  Next renewal: 2026-09-06  [Cancel Plan]          │
└───────────────────────────────────────────────────┘
```

### 9.3 交互规范

- 月付/年付 Toggle 开关置于 PRO 卡片顶部，切换价格即时更新
- `Upgrade to Pro →`：跳转 Stripe Checkout（新 Tab）
- `Manage →`：跳转 Stripe 客户门户
- `Cancel Plan`：弹出确认 Modal，含取消后权益说明
- Pro 用户：Free 卡片变灰，Pro 卡片加 `Current Plan` 绿色徽章

---

## 10. Usage History 页

### 10.1 页面目标

让用户感知自己的活跃情况，辅助免费用户决策升级。

### 10.2 布局结构

```
┌───────────────────────────────────────────────────┐
│  Usage Overview · This Week                       │
│  [← 上周]                        [本周 →]         │
│                                                   │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌─────────┐ │
│  │ 24     │  │  37    │  │   5    │  │    3    │ │
│  │ Total  │  │ Chats  │  │ Tools  │  │ Shared  │ │
│  └────────┘  └────────┘  └────────┘  └─────────┘ │
│                                                   │
│  活动柱状图（按天，7根柱子）                          │
│  Mon Tue Wed Thu Fri Sat Sun                      │
│   █   ██   █  ███   █   ░   ░                    │
│                                                   │
│  ─────────────────────────────────────────────── │
│  Tool Breakdown                                   │
│  Formulas   ████████░░  16 uses                   │
│  SQL        █████░░░░░  10 uses                   │
│  Scripts    ████░░░░░░   8 uses                   │
│  Regex      ███░░░░░░░   3 uses                   │
│                                                   │
│  ─────────────────────────────────────────────── │
│  [免费用户升级提示 Banner]                          │
│  You've used 80% of your monthly quota.           │
│  Upgrade to Pro for unlimited access. [Upgrade →] │
└───────────────────────────────────────────────────┘
```

### 10.3 交互规范

- 周切换：点击 `← 上周` / `本周 →` 切换统计周期
- 柱状图悬停：Tooltip 显示该天具体使用次数
- 升级提示 Banner：仅当本月用量 ≥ 70% 时显示，颜色随用量变化（黄→橙→红）

---

## 附录 A：工具页通用交互规范

| 规范项 | 说明 |
|--------|------|
| 布局 | 左输入（40%）·右结果（60%），1024px 以下堆叠为上下布局 |
| 必备按钮 | Generate（主色）/ Reset（白底灰边）/ Copy（结果区右上角） |
| 加载中 | Generate 按钮变 `Generating...` + spinner，右侧显示骨架屏 |
| 空态 | 右侧居中插图 + 提示文字，无额外操作 |
| 复制成功 | 按钮变 `Copied ✓` 持续 2 秒后复原 |
| Try in Chat | 所有工具结果区提供此入口，跳转 AI Chat 并带入上下文 |

---

## 附录 B：QuotaModal（配额耗尽弹窗）

触发条件：免费用户调用 API 时额度已耗尽。

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

- 背景遮罩：rgba(0,0,0,0.5)
- 不可通过点击遮罩关闭（强引导）
- 仅 `Wait for reset` 可关闭

---

## 附录 C：响应式断点

| 断点 | 适配策略 |
|------|---------|
| ≥ 1280px | 标准三区布局 |
| 1024px–1279px | Sidebar 折叠为 icon-only（宽度收缩至 60px） |
| 768px–1023px | 工具页改为上下布局（输入在上，结果在下） |
| < 768px | Sidebar 变为底部 Tab Bar，工具页全宽单列 |
