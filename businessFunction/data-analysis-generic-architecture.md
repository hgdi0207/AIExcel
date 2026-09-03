# Data Analysis 通用分析架构设计

版本：V1.0  
日期：2026-08-18  
关联文档：
- `businessFunction/gptexcel-prd.md`
- `businessFunction/gptexcel-tech-architecture.md`
- `businessFunction/gptexcel-api-spec.md`

## 1. 文档目标

本文档用于回答一个核心问题：

- 用户上传任意结构的 Excel / CSV 后，我们如何不依赖固定模板，也能稳定完成 `Data Analysis`。

本文档重点不是页面交互，而是：

- 通用分析链路
- 中间数据结构
- 程序化分析与 AI 总结的分工
- 模型路由策略
- 对当前 NestJS 实现需要补齐的能力

## 2. 结论先行

`Data Analysis` 不能只靠“把 workbook 摘要和 5 行 sampleRows 发给模型”完成。

更稳妥的方案是：

1. 先把上传文件解析成统一的结构化中间表示。
2. 再用程序化分析引擎做可验证的统计、聚合、趋势、异常、质量检查。
3. 最后只把“结构化事实 + 用户问题 + 少量原始上下文”交给模型生成自然语言洞察。

这意味着：

- 不要求用户的 Excel 有固定模板。
- 但要求系统能识别出“可分析的表格区域”。
- 真正的数值计算尽量不交给模型拍脑袋推断。
- 模型负责解释、归纳、排序、生成结论，不负责替代基础计算引擎。

## 3. 适用范围与边界

### 3.1 适用范围

- 单 sheet 明细表分析
- 多 sheet 但结构相近的明细表分析
- 明细表 + 汇总表混合工作簿分析
- 财务、销售、运营、库存、客服等常见二维表格
- `.xlsx`、`.xls`、`.csv`

### 3.2 不保证一次性完美支持的场景

- 纯视觉排版型工作簿
- 大量合并单元格、空行空列穿插的报表
- 图片、截图、扫描件为主的文件
- 高度依赖复杂宏、外部数据连接、Power Query 的文件
- 表头跨 3 行以上且无明显数据起点的工作表

### 3.3 产品口径

对外不宣称“任意 Excel 100% 自动分析正确”，而应表述为：

- 支持绝大多数常见结构化表格的自动分析
- 对复杂工作簿优先识别最可分析的数据区域
- 无法可靠识别时给出澄清提示或候选数据区域供用户选择

## 4. 当前实现现状与差距

结合当前代码，`Data Analysis` 现状大致是：

- 上传时解析 sheet 名、表头、前 5 行样例、基础 summaryMd
- 创建分析任务时，把 `workbook.summaryMd + headers + sampleRows` 发给模型
- 模型直接返回 `summaryMd + insights`

当前方式的优点：

- 实现快
- 可跑通 MVP 基本链路

当前方式的核心问题：

- 样例行太少，模型看不到完整数据分布
- 无法可靠完成月度趋势、异常值、排名、同比环比等真实计算
- 多 sheet 分析时，模型只能猜数据关系
- 如果 summary sheet 有空值或错误，模型容易被误导
- 结果可读，但不够可验证，也不够稳定

因此，`Data Analysis` 需要从“Prompt 驱动分析”升级为“数据引擎驱动分析 + AI 表达”。

## 5. 目标架构

## 5.1 总体分层

```text
用户上传 Excel/CSV
        |
        v
Workbook Ingestion
        |
        v
Sheet / Table Region Detection
        |
        v
Schema Inference & Profiling
        |
        v
Analysis Planner
        |
        +--> Deterministic Analysis Engine
        |      - 聚合
        |      - 趋势
        |      - 异常
        |      - 排名
        |      - 对比
        |      - 数据质量检查
        |
        +--> Optional LLM Planning / Disambiguation
        |
        v
Fact Pack
        |
        v
LLM Insight Generator
        |
        v
summaryMd + insights + evidence + followups
```

## 5.2 分层原则

- 解析层：负责把文件变成统一结构
- 识别层：负责找到真正可分析的表格区域
- 计算层：负责产生可验证事实
- 生成层：负责把事实转成用户能读懂的分析结论

## 6. 核心设计原则

### 6.1 程序化优先

凡是可以通过代码稳定计算出来的内容，不依赖模型推理：

- 总和、平均值、中位数、最大最小值
- 分组聚合
- Top N / Bottom N
- 环比、同比、增长率
- 缺失值比例
- 异常值检测
- 重复值检测

### 6.2 模型只处理高层表达

模型更适合做：

- 从多个事实中挑重点
- 用业务语言解释趋势和异常
- 根据用户问题组织结论顺序
- 生成“下一步建议”
- 在多候选分析路径中做轻量规划

### 6.3 不依赖固定模板

系统不要求用户必须上传预定义列名，但会做：

- 表格区域识别
- 表头候选识别
- 字段类型推断
- 时间列、维度列、指标列识别

### 6.4 面向证据输出

分析结果不只返回结论，还要返回证据：

- 该结论来自哪个 sheet / table region
- 使用了哪些字段
- 关键统计值是什么
- 是否存在低置信度或数据质量风险

## 7. 通用中间表示

建议在 `Workbook` 和 `WorkbookSheet` 之上，引入更细的“可分析数据区域”概念。

### 7.1 建议新增概念：Table Region

一个 sheet 内可能有多个独立表格，因此不能假设“整张 sheet 就是一张表”。

建议中间结构：

```json
{
  "workbookId": "wb_xxx",
  "sheets": [
    {
      "sheetName": "Sales",
      "tableRegions": [
        {
          "regionId": "tbl_sales_1",
          "range": "A1:G1200",
          "headerRowIndex": 1,
          "dataStartRowIndex": 2,
          "rowCount": 1199,
          "columnCount": 7,
          "confidence": 0.94
        }
      ]
    }
  ]
}
```

### 7.2 建议新增概念：Field Profile

每个字段要有机器可读画像：

```json
{
  "fieldName": "Revenue",
  "normalizedFieldName": "revenue",
  "dataType": "number",
  "semanticRole": "metric",
  "nonNullRatio": 0.98,
  "distinctCount": 53,
  "exampleValues": ["125000", "132000", "98000"],
  "min": 87000,
  "max": 170000,
  "mean": 121533.2,
  "currencyHint": "USD"
}
```

### 7.3 建议新增概念：Analysis Fact Pack

计算层输出统一事实包，再交给模型：

```json
{
  "datasetId": "tbl_sales_1",
  "grain": "monthly_by_region",
  "facts": {
    "totals": [],
    "trends": [],
    "anomalies": [],
    "rankings": [],
    "qualityWarnings": []
  },
  "confidence": 0.91
}
```

## 8. 详细处理链路

## 8.1 阶段一：文件解析

输入：

- `.xlsx`
- `.xls`
- `.csv`

输出：

- workbook 基础元信息
- sheet 列表
- 原始单元格矩阵或可遍历结构

要求：

- 保留日期、数字、文本、布尔、公式结果
- 记录原始格式信息，便于后续识别货币、百分比、日期

## 8.2 阶段二：表格区域识别

目标：在每个 sheet 中找出最可能的结构化数据区。

基础规则：

- 连续非空矩形区域优先
- 第一行或前几行中“文本占比高”的区域优先识别为表头候选
- 后续行若数值和文本分布更稳定，则更像数据体
- 完全空行 / 装饰性标题 / 注释块不计入数据区

MVP 建议：

- 每个 sheet 先只选 1 个主表格区域
- 同时保留 1 到 3 个候选区域，供复杂场景回退

## 8.3 阶段三：字段推断

针对每个 `tableRegion`，推断：

- 字段名
- 字段类型：`string | number | date | boolean | mixed`
- 语义角色：`dimension | metric | time | id | category | text_note`
- 是否适合聚合
- 是否适合作为时间轴

常见启发式：

- 列名包含 `date/month/week/year`，优先判定为时间列
- 数值占比高、重复率低且带货币格式，优先判定为指标列
- 文本重复率较高，优先判定为维度列
- 形如 `id/order_no/user_id`，优先判定为标识列

## 8.4 阶段四：数据质量检查

在进入业务分析前，先做质量扫描：

- 空值率
- 重复行
- 数值列中的文本污染
- 日期列不可解析比例
- 汇总 sheet 与明细 sheet 是否明显冲突
- 指标列是否全空

质量检查的价值：

- 避免模型基于脏数据输出过度自信结论
- 能把“不能分析”的原因说清楚

## 8.5 阶段五：分析规划

分析规划器根据以下输入决定要跑哪些分析算子：

- 用户 prompt
- 字段画像
- 数据规模
- 是否存在时间列
- 是否存在适合分组的维度列
- 是否存在适合聚合的指标列

规划结果示例：

```json
{
  "datasetId": "tbl_sales_1",
  "tasks": [
    "overall_summary",
    "monthly_trend",
    "region_breakdown",
    "top_bottom_regions",
    "outlier_detection",
    "data_quality_check"
  ]
}
```

## 8.6 阶段六：确定性分析引擎

建议支持的基础算子：

- `overall_summary`
- `group_aggregate`
- `time_series_trend`
- `period_over_period`
- `ranking_top_n`
- `ranking_bottom_n`
- `contribution_share`
- `outlier_iqr`
- `outlier_zscore`
- `missing_value_scan`
- `duplicate_scan`
- `cross_sheet_consistency_check`

MVP 先做这 6 个最有价值：

- 总览汇总
- 分组聚合
- 时间趋势
- Top / Bottom 排名
- 异常检测
- 数据质量检测

## 8.7 阶段七：LLM 洞察生成

模型输入不再是全量 workbook，而是：

- 用户问题
- workbook 简要摘要
- 选中的 dataset 元信息
- 事实包 `Fact Pack`
- 置信度和质量警告
- 最多 3 到 5 行代表性样本

模型输出建议结构：

```json
{
  "summaryMd": "markdown",
  "insights": [
    {
      "type": "trend",
      "title": "string",
      "description": "string",
      "evidence": {
        "sheetName": "Sales",
        "fields": ["Month", "Revenue"],
        "stats": {
          "jan": 420000,
          "feb": 447000,
          "mar": 473000
        }
      }
    }
  ],
  "followupSuggestions": [
    "Create a monthly revenue chart",
    "Compare profit margin by region"
  ]
}
```

## 9. 通用分析策略

## 9.1 自动模式

当用户没写明确 prompt，系统自动执行：

- 找主表
- 识别时间列、主要维度、主要指标
- 输出 1 条总览摘要
- 输出 2 到 4 条高价值洞察
- 输出 1 到 2 条质量警告

## 9.2 目标驱动模式

当用户给了明确任务，如：

- `Analyze sales trends and outliers`
- `Which region underperformed in Q1?`
- `Compare revenue and profit by month`

系统按 prompt 调整分析规划，优先跑相关算子。

## 9.3 多 sheet 模式

多 sheet 不等于一定全量联动。

建议优先支持三类多 sheet：

- 同结构多月份明细 sheet 合并分析
- 明细 sheet + 汇总 sheet 交叉校验
- 主数据 sheet + 交易明细 sheet 的轻量关联

MVP 不建议一上来做复杂 SQL 式跨表 Join 推理。

## 10. 模型使用策略

已确认的模型口径：

- 默认：`gpt-5.6-terra`
- 复杂分析：`gpt-5.6-sol`
- 低成本高频：`gpt-5.6-luna`

### 10.1 路由建议

- `luna`
  - 字段命名标准化
  - 轻量字段语义识别
  - 分析结果标题改写
- `terra`
  - 常规分析总结
  - 多事实归纳
  - 用户追问的解释
- `sol`
  - 多 sheet 复杂分析
  - 事实冲突时的综合判断
  - 长篇管理层摘要

### 10.2 是否把 Excel 原文件直接传给模型

默认不建议。

默认流程应是：

1. 文件落盘并解析
2. 生成结构化中间表示
3. 程序计算事实
4. 仅在必要时才把原文件或局部数据块作为补充上下文给模型

只有以下场景才考虑原文件输入：

- 解析层无法准确识别复杂布局
- 用户明确要求解释公式或原工作簿结构
- 后续启用 Responses API 的文件输入 / code interpreter 做补充处理

## 11. 对当前 NestJS 实现的落地建议

## 11.1 当前最小可行升级路径

按收益优先级，建议顺序如下：

1. `FilesService` 扩展解析结果
2. 新增 `Table Region Detector`
3. 新增 `Field Profiler`
4. 新增 `Analysis Engine`
5. 重写 `AiService.generateAnalysis()` 的输入，不再只传 summary 和 sample

## 11.2 建议新增模块

### `backend/src/modules/workbook-analysis/`

职责：

- sheet 主表格区域识别
- 字段画像生成
- 分析事实包生成

建议文件：

- `table-region.detector.ts`
- `field-profiler.ts`
- `analysis-planner.ts`
- `analysis-engine.ts`
- `fact-pack.builder.ts`

### `backend/src/modules/data-analysis/`

保留现有 controller，但 service 层改为：

```text
load workbook preview
-> build dataset candidates
-> choose analysis target
-> run deterministic analysis
-> call LLM for summary
-> persist structured result
```

## 11.3 对现有 `FilesService` 的改造建议

当前仅保存：

- headers
- sampleRows
- summaryMd
- rowCount
- columnCount

建议补充：

- `columnTypesJson`
- `formulaColumnsJson`
- `tableRegionsJson`
- `fieldProfilesJson`
- `qualityProfileJson`

注意：

- `sampleRows` 仍保留，但只作为预览和提示辅助
- 不能再把 `sampleRows` 当作主要分析依据

## 11.4 对 `AiService.generateAnalysis()` 的改造建议

当前输入偏弱：

- `workbook.summaryMd`
- `sheet.headers`
- `sheet.sampleRows`

目标输入应改为：

- workbook 摘要
- 目标 dataset 摘要
- 字段画像
- 关键统计事实
- 质量警告
- 用户问题

模型 Prompt 的角色应变成：

- 解释事实
- 组织结论
- 给建议

而不是：

- 自己从极少样本里猜完整分析结果

## 12. 数据库存储建议

MVP 阶段不一定要立即新增很多表，可以先扩展 JSON 字段。

建议优先扩展：

- `workbooks.summary_json`
- `workbook_sheets.column_types_json`
- `workbook_sheets.formula_columns_json`

建议新增 JSON 内容：

- `tableRegions`
- `fieldProfiles`
- `qualityProfile`

`analysis_jobs` 结果建议逐步从只有 `summary_md + insights_json` 扩展为：

- `summary_md`
- `insights_json`
- `facts_json`
- `dataset_ref_json`
- `quality_warnings_json`
- `confidence_score`

## 13. API 与结果结构建议

现有 API 可以不改路径，但结果建议增强。

`GET /api/data-analysis/:id` 的 `result` 建议最终包含：

```json
{
  "summaryMd": "markdown",
  "insights": [],
  "facts": {},
  "dataset": {
    "sheetName": "Sales",
    "regionId": "tbl_sales_1"
  },
  "qualityWarnings": [],
  "confidenceScore": 0.91,
  "followupSuggestions": []
}
```

这样前端后续才能支持：

- 展开证据
- 高亮来源 sheet
- 跳转生成图表
- 跳转生成报告

## 14. 错误处理与降级

### 14.1 无法识别主表时

返回：

- `analysis_not_ready`
- 候选 sheet / candidate region
- 提示用户选择更明确的数据区域

### 14.2 数据质量过差时

允许输出“有限分析”，但必须带风险提示：

- 汇总表为空
- 关键指标列全空
- 日期列不可解析
- 数值列混入大量文本

### 14.3 数据规模过大时

优先策略：

- 程序化全量聚合
- 只把聚合结果和样本交给模型

而不是：

- 把超大原表全文塞给模型

## 15. 开发分期建议

### Phase 1：把结果从“样本猜测”升级为“可验证统计”

目标：

- 单 sheet 主表识别
- 字段类型推断
- 总览汇总
- 分组聚合
- 时间趋势
- 质量检查
- LLM 基于事实生成摘要

### Phase 2：增强多维分析能力

目标：

- Top / Bottom 排名
- 异常检测
- 贡献占比
- 多指标联合结论
- 多 sheet 轻量联动

### Phase 3：高级复杂分析

目标：

- 跨 sheet 对账
- 更复杂的时间序列模式
- 结合 code interpreter 的疑难文件补充分析
- 更强的图表 / 报告联动

## 16. 验收标准

当 `Data Analysis` 满足以下条件，才算真正进入可商用的通用分析能力：

- 对常见销售/财务/运营明细表，不需要固定模板即可输出稳定结果
- 趋势、汇总、Top/Bottom、异常结论可被程序计算复核
- 当数据质量差时，系统会明确提示风险而不是直接胡乱总结
- 多数结果优于“只看 headers + 5 行 sampleRows”的纯 prompt 方案
- 结果可继续流转到 `Charts & Graphs` 和 `Reports`

## 17. 最终建议

对这个项目，`Data Analysis` 的正确方向不是“继续调 prompt”，而是：

- 先建设通用数据分析底座
- 再让模型站在事实之上生成洞察

一句话概括：

- `Data Analysis = Workbook Parsing + Table Detection + Field Profiling + Deterministic Analytics + LLM Insight Generation`

