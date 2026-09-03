# GPTExcel.uk 网站功能分析

分析日期：2026-08-06  
来源：GPTExcel 官网公开页面 + 登录后页面截图

## 1. 产品定位

GPTExcel 是一个围绕电子表格办公场景设计的 AI SaaS。它不是单一的“公式生成器”，而是一个以 Excel / Google Sheets / SQL / Regex / Template 为核心工具集合的效率平台。

从登录后后台结构看，它的产品形态更接近“AI 办公工具箱”：

- 用 AI Chat 作为总入口，承接泛问题、文件对话和复杂需求。
- 用 Formulas、Scripts、SQL、Regex、Template 作为垂直工具页，承接高频、标准化任务。
- 用 Dashboard、Billing、Usage History 组成用户后台，完成留存、转化和配额管理。

## 2. 登录后信息架构

根据截图，登录后左侧主菜单包括：

- Dashboard
- AI Chat
- Formulas
- Scripts
- SQL
- Regex
- Template
- Billing
- Usage History

辅助入口与运营位包括：

- `Upgrade to Pro` 升级卡片
- 当前配额显示：`AI Chat` 与 `Other Tools`
- `Feedback` 反馈入口
- 右上角通知入口
- 右上角用户头像/账户入口

补充观察：

- `AI Chat` 菜单带有 `updated` 标记，说明产品会通过菜单徽标提示功能更新。
- `Pivot Tables` 没有出现在左侧菜单，但出现在 Dashboard 卡片中，且带 `New` 标记，说明它可能是新功能，当前通过首页卡片引导进入，而不是固定一级导航。

## 3. Dashboard 页面分析

路由：`/dashboard`

Dashboard 是登录后的总控页，主要用途不是展示复杂数据，而是做工具导航和升级转化。页面包含以下功能卡片：

- AI Chat
- Pivot Tables
- Formulas
- Scripts
- SQL
- Regex
- Template
- Billing

这类首页设计的价值：

- 帮助新用户快速理解产品能力边界。
- 让核心工具在首屏可点击，降低学习成本。
- 把 `Billing` 放进主卡片区，直接服务付费转化。
- 对新功能使用 `New` 标记进行曝光。

## 4. 核心功能模块拆解

### 4.1 AI Chat

路由：`/chat`

这是平台级总入口，页面结构明显比单一工具页更复杂，包含：

- 左侧 `Chat History` 历史会话列表
- `New Chat` 新建会话按钮
- 预置问题 / 示例提示词卡片
- 主输入框
- 底部快捷工具按钮
- 发送按钮
- 清空历史入口

从截图可见的预置提示词示例：

- Whats new in GPT-Excel?
- List all your capabilities and features.
- Create a table for Tracking Investment Portfolio
- What kind of Charts can you generate?
- How to extract text between the first and last period in cell E2 on google sheets.
- Automate updating sales data every Monday for specific cells like A2 to C100 on Excel.

说明该模块承担的任务不只是普通对话，还包括：

- 功能发现与产品教育
- 复杂需求收集
- 公式 / 图表 / 自动化脚本等综合型任务
- 文件相关问答

这类设计很适合作为你要复刻产品中的“超级入口”。

### 4.2 Formulas

路由：`/formulas`

页面采用左右双栏布局：

- 左侧输入区
- 右侧结果区

具体交互包括：

- `I am using ...` 平台选择器，默认可见 `Microsoft Excel`
- 设置按钮
- 输出模式切换：`GENERATED` / `EXPLAINED`
- 文本输入框，要求用户自然语言描述需求
- `generate` 按钮
- 结果区
- `reset` 按钮
- `copy` 按钮

这说明 Formula 工具至少支持两种模式：

- 生成公式
- 解释公式

这也是整个产品最值得复用的标准工具页模板。

### 4.3 Scripts

路由：`/scripts`

页面结构与 Formulas 基本一致，但面向脚本生成：

- 平台/脚本类型下拉框，截图中默认是 `Visual Basic Script (VBA)`
- 输出模式切换：`GENERATED` / `EXPLAINED`
- 自然语言需求输入框
- `generate` / `reset` / `copy`
- 结果展示区

从页面定位可以推断它至少服务以下场景：

- Excel VBA 自动化脚本生成
- 脚本解释与学习
- 办公任务自动化

结合公开站文案，它大概率还兼容 Google Apps Script 等脚本目标。

### 4.4 SQL

路由：`/sql`

页面结构同样延续双栏标准模式：

- SQL 类型选择器
- 输出模式：`GENERATED` / `EXPLAINED`
- 自然语言描述区
- 结果展示区
- `generate` / `reset` / `copy`

截图中的提示文案强调：

- 用户应提供表名、字段名
- 系统会据此生成更准确的查询

说明该工具不是“在线执行 SQL”，而更像“SQL 文本生成 / 解释助手”。

### 4.5 Regex

路由：`/regex`

页面结构继续复用标准生成器模式：

- 模式切换：`GENERATED` / `EXPLAINED`
- 输入框用于描述匹配规则
- 结果展示区
- `generate` / `reset` / `copy`

截图中的示例是：

- Match a valid email address with gptexcel.com domain

说明它服务的是文本处理、校验、提取等开发或办公辅助场景。

### 4.6 Template

路由：`/template`

这个页面和前面几个工具页不同，功能更像“结构化产物生成器”，主要包含：

- 模板需求描述输入框
- `Number of rows` 行数设置
- `Include Excel Formulas` 复选项
- 示例快捷标签
- `generate` 按钮
- 右侧结果预览表格
- `Download` 下载按钮
- `Best Practices` 入口

示例模板标签包括：

- Monthly Budget Tracker
- Investment Portfolio Tracker
- Employee Shift Schedule
- Marketing Campaign Analytics
- Sales funnel tracker
- Product Launch Checklist
- Class Attendance Tracker
- Workout Log and Planner
- Meal Planning and Grocery List

这个模块很关键，因为它不仅生成文本，还生成“可下载的表格结构结果”。这意味着产品后端可能需要：

- 表头结构生成
- 示例数据填充
- 公式列自动计算
- 文件导出能力

### 4.7 Pivot Tables

入口位置：Dashboard 卡片

截图显示的文案是：

- Create and Analyze Pivot Tables with the 'Pivot Builder'

并带有 `New` 标记。

可以推断这是一个相对新的专项工具，定位大概率是：

- 引导用户通过自然语言描述透视分析需求
- 自动给出透视表字段布局
- 帮助用户完成行、列、值、筛选器设计
- 可能进一步生成操作步骤或配置建议

由于它目前未进入左侧一级菜单，说明产品还在逐步验证这一功能的使用率。

### 4.8 Billing

左侧菜单和 Dashboard 卡片都提供 Billing 入口，说明该页是核心转化页面。

从截图可确认的定位是：

- 管理订阅
- 管理账单信息

配合左侧固定 `Upgrade to Pro` 模块，形成了比较直接的付费转化路径。

### 4.9 Usage History

路由：`/usage`

这是典型的“配额与活跃度反馈页面”，截图中包括：

- 周时间窗口显示
- `Chats (last week)`
- `History items (last week)`
- `Shared (last week)`
- `Last Week Activity`
- `Chats vs Other Tools`
- `Tool Usage (Last Week)`

这个页面的作用：

- 让用户看到自己的实际使用情况
- 让免费用户意识到资源有限
- 给升级决策提供量化依据
- 为“团队协作 / 分享能力”预留认知入口

其中 `Shared` 指标说明产品很可能存在聊天或结果分享能力，即使截图中未直接展示入口。

## 5. 通用交互模式总结

登录后页面体现出很强的“统一工具框架”，对复刻非常有参考价值。

### 5.1 双栏工作区

Formulas、Scripts、SQL、Regex、Template 都采用：

- 左侧输入
- 右侧结果

优点是：

- 用户输入和结果对照清晰
- 便于加入复制、重置、下载等动作
- 容易扩展更多输出卡片或解释说明

### 5.2 生成 / 解释双模式

多个工具都支持：

- `GENERATED`
- `EXPLAINED`

这说明 GPTExcel 并不只解决“帮我生成”，也解决“帮我理解”。这对新手用户留存很重要。

### 5.3 强提示词驱动

每个页面都在输入框附近提供明确的引导文案和示例，这降低了用户的输入门槛。尤其 AI Chat 页通过示例卡片，直接把用户往高价值场景引导。

### 5.4 结果操作能力

结果区普遍配有：

- `copy`
- `reset`
- `download`（Template 页）

说明产品设计目标是“让结果立刻被使用”，而不是停留在演示层。

## 6. 商业化与增长设计

根据截图，商业化设计相当直接：

- 左下固定 `Upgrade to Pro` 卡片
- 明确显示 `AI Chat` 与 `Other Tools` 配额
- 在免费额度边缘持续提醒升级
- `Billing` 同时放入导航和 Dashboard
- 用 `updated` / `New` 标签提升新功能点击率
- 用 `Feedback` 入口收集真实需求

从你截图中的免费配额状态看：

- AI Chat：`1 / 10`
- Other Tools：`0 / 4`

这与官网公开定价文案是呼应的，说明免费版的限制不仅写在价格页，也被深度嵌入登录后界面。

## 7. 对你要复刻网站的产品建议

如果你要做一个类似 GPTExcel 的网站，MVP 不建议一开始就把所有能力同时做满，建议按下面的优先级推进。

### 7.1 第一阶段 MVP

- 登录注册
- Dashboard
- AI Chat
- Formulas
- Scripts
- SQL
- Regex
- Billing
- 免费额度与升级提示

原因：

- 这几项已经能形成完整闭环
- AI Chat 负责泛化需求
- 单点工具页负责高频转换
- Billing 和配额是商业化最小闭环

### 7.2 第二阶段增强

- Template 生成与下载
- Pivot Tables
- 使用历史统计
- 分享能力
- 通知系统
- 反馈系统

原因：

- 这些功能更偏留存、差异化和增长
- 技术复杂度高于简单文本生成
- 更适合在有基础流量后逐步补齐

## 8. 技术实现推断

从界面形态推断，你的系统至少需要以下能力：

- 用户系统：登录、头像、订阅状态、配额状态
- 通用 AI 调用层：支持不同工具共用同一套模型服务
- Prompt 模板层：按 Formula / Script / SQL / Regex / Template 区分提示词
- 工具结果层：文本结果、解释结果、表格结构结果
- 文件导出层：至少支持模板结果下载
- 用量统计层：按聊天、工具、周期进行统计
- 运营配置层：功能徽标、示例提示词、升级文案、入口排序

## 9. 结论

GPTExcel 的核心竞争力不只是“会生成公式”，而是把多个高频办公 AI 工具封装成统一后台，并通过：

- 简单清晰的左侧导航
- 标准化的输入/结果工作区
- 免费额度 + 升级卡片
- AI Chat 超级入口
- 专项工具页承接高频任务

来完成从获客、激活、留存到付费的闭环。

如果你要做一个类似产品，最值得优先复刻的不是首页文案，而是这套“登录后工具后台 + 配额驱动增长”的产品结构。

## 10. 模型供应商判断

公开页面没有写死具体模型名。

已确认：

- 条款和隐私页明确写了 `third-party AI providers`
- 默认不会把聊天内容用于训练，除非用户选择 opt-in
- 前端和公开页面没有暴露 `OpenAI`、`Claude`、`Anthropic`、`Gemini` 等明确标识

高置信推断：

- 它大概率接了一个或多个通用大模型 API
- 公式、SQL、Regex、脚本这类任务更像是“统一提示词 + 不同工具路由”的多模型/单模型封装层
- 目前没有足够公开证据判断具体是 OpenAI、Anthropic 还是其他供应商

## 11. 参考路由

- `https://gptexcel.uk/dashboard`
- `https://gptexcel.uk/chat`
- `https://gptexcel.uk/formulas`
- `https://gptexcel.uk/scripts`
- `https://gptexcel.uk/sql`
- `https://gptexcel.uk/regex`
- `https://gptexcel.uk/template`
- `https://gptexcel.uk/usage`
