# Data Analysis 数据库表与 API 详细任务清单

版本：V1.0  
日期：2026-08-19  
关联文档：
- `businessFunction/data-analysis-generic-architecture.md`
- `businessFunction/data-analysis-development-tasks.md`
- `businessFunction/gptexcel-db-schema.md`
- `businessFunction/gptexcel-api-spec.md`

## 1. 文档目标

本文档用于把 `Data Analysis` 的通用分析架构继续拆到：

- 数据库字段级别
- Prisma / Migration 级别
- API 请求响应级别
- 后端模块改造级别
- 联调与验收级别

目标是让后续开发可以直接按表、按接口、按模块推进。

## 2. 当前现状

### 2.1 已有数据表能力

当前已具备：

- `workbooks`
- `workbook_sheets`
- `analysis_jobs`
- `ai_requests`
- 通用 `jobs` 查询链路

### 2.2 当前 `analysis_jobs` 能力偏弱

目前 `analysis_jobs` 主要只有：

- `scope_json`
- `summary_md`
- `insights_json`
- `complexity`
- `status`

这足以支持“模型生成摘要”，但不足以支持：

- 可验证的事实输出
- 数据质量告警
- 目标数据区域回溯
- 置信度判断
- Charts / Reports 复用

### 2.3 当前 `workbook_sheets` 能力也偏弱

目前 `workbook_sheets` 主要只有：

- `header_json`
- `column_types_json`
- `formula_columns_json`
- `sample_rows_json`

但还没有保存：

- 主表格区域
- 字段画像
- 质量画像
- 候选分析区域

## 3. 数据库设计任务

## 3.1 `workbooks` 扩展任务

目标：保存工作簿级别的分析摘要和候选数据集信息。

建议扩展 `summary_json` 内容，而不是第一阶段就加很多新列。

### 建议写入内容

```json
{
  "sheetCount": 3,
  "rowCount": 1200,
  "columnCount": 9,
  "candidateDatasets": [
    {
      "sheetName": "Sales",
      "regionId": "tbl_sales_1",
      "confidence": 0.94
    }
  ],
  "workbookQuality": {
    "hasMergedLayoutRisk": false,
    "hasEmptySummarySheet": true
  }
}
```

### 开发任务

- 上传解析时补充 `candidateDatasets`
- 上传解析时补充 `workbookQuality`
- 更新 `FilesService.parseWorkbook()`

### 验收

- `workbooks.summary_json` 中能看到候选 dataset 列表

## 3.2 `workbook_sheets` 扩展任务

目标：让每个 sheet 可作为后续分析的可复用数据源描述对象。

### 建议新增字段

建议在 Prisma 中新增：

- `tableRegionsJson Json? @map("table_regions_json")`
- `fieldProfilesJson Json? @map("field_profiles_json")`
- `qualityProfileJson Json? @map("quality_profile_json")`

### 字段说明

#### `table_regions_json`

保存主表和候选表格区域：

```json
[
  {
    "regionId": "tbl_sales_1",
    "range": "A1:G1200",
    "headerRowIndex": 1,
    "dataStartRowIndex": 2,
    "rowCount": 1199,
    "columnCount": 7,
    "confidence": 0.94,
    "isPrimary": true
  }
]
```

#### `field_profiles_json`

保存字段画像：

```json
[
  {
    "fieldName": "Revenue",
    "normalizedFieldName": "revenue",
    "dataType": "number",
    "semanticRole": "metric",
    "nonNullRatio": 0.98,
    "distinctCount": 53,
    "min": 87000,
    "max": 170000,
    "mean": 121533.2
  }
]
```

#### `quality_profile_json`

保存 sheet 级质量信息：

```json
{
  "blankRowRatio": 0.01,
  "duplicateRowCount": 3,
  "invalidDateColumns": ["Month"],
  "numericPollutionColumns": ["Revenue"],
  "warnings": [
    "Summary sheet contains blank totals"
  ]
}
```

### 开发任务

- 修改 `prisma/schema.prisma`
- 生成 migration
- 修改上传解析写入逻辑
- 修改 `getWorkbookPreview()` 输出结构

### 验收

- 一个 sheet 的可分析区域、字段画像、质量画像都能持久化

## 3.3 `analysis_jobs` 扩展任务

目标：让分析任务结果既可展示，也可复核，还能被后续工具复用。

### 建议新增字段

建议在 Prisma 中新增：

- `factsJson Json? @map("facts_json")`
- `datasetRefJson Json? @map("dataset_ref_json")`
- `qualityWarningsJson Json? @map("quality_warnings_json")`
- `followupSuggestionsJson Json? @map("followup_suggestions_json")`
- `confidenceScore Decimal? @map("confidence_score") @db.Decimal(5,4)`

### 字段说明

#### `facts_json`

保存程序化分析结果：

```json
{
  "totals": {
    "revenue": 1340000,
    "profit": 442000
  },
  "trends": [
    {
      "metric": "revenue",
      "grain": "month",
      "points": [
        { "period": "2025-01", "value": 420000 },
        { "period": "2025-02", "value": 447000 },
        { "period": "2025-03", "value": 473000 }
      ]
    }
  ],
  "rankings": [],
  "anomalies": []
}
```

#### `dataset_ref_json`

保存本次分析针对哪个数据区域：

```json
{
  "sheetName": "Sales",
  "regionId": "tbl_sales_1",
  "range": "A1:G1200"
}
```

#### `quality_warnings_json`

保存结果级风险：

```json
[
  {
    "type": "quality",
    "level": "warning",
    "message": "Summary sheet appears incomplete and should not be trusted."
  }
]
```

#### `followup_suggestions_json`

保存后续推荐动作：

```json
[
  "Create a monthly revenue chart",
  "Compare profit margin by region",
  "Generate an executive report"
]
```

### 开发任务

- 修改 `AnalysisJob` Prisma model
- 生成 migration
- 修改 `JobsService` 的 analysis result 持久化逻辑
- 修改 `toAnalysisJobRecord()` 返回结构

### 验收

- 分析任务完成后，不只保存摘要，还保存事实、数据集引用、质量告警和置信度

## 3.4 是否新增独立分析结果表

第一阶段建议不新增独立表。

原因：

- 现阶段 JSON 字段足够承接
- 可以先把链路跑通
- 减少 schema 复杂度

第二阶段再考虑是否拆：

- `analysis_job_facts`
- `analysis_job_datasets`
- `analysis_job_warnings`

## 4. Prisma 与 Migration 任务

## 4.1 Prisma schema 修改任务

需要修改：

- `WorkbookSheet`
- `AnalysisJob`

### `WorkbookSheet` 建议新增

```prisma
tableRegionsJson  Json? @map("table_regions_json")
fieldProfilesJson Json? @map("field_profiles_json")
qualityProfileJson Json? @map("quality_profile_json")
```

### `AnalysisJob` 建议新增

```prisma
factsJson               Json?    @map("facts_json")
datasetRefJson          Json?    @map("dataset_ref_json")
qualityWarningsJson     Json?    @map("quality_warnings_json")
followupSuggestionsJson Json?    @map("followup_suggestions_json")
confidenceScore         Decimal? @map("confidence_score") @db.Decimal(5, 4)
```

## 4.2 Migration 任务

任务顺序：

1. 修改 Prisma schema
2. 生成 migration
3. 在开发库执行 migrate
4. 更新 `gptexcel-db-schema.md`

### 验收

- 本地数据库新增字段成功
- Prisma generate 成功
- 现有上传和分析任务不报错

## 5. API 设计任务

## 5.1 `POST /api/data-analysis` 改造任务

当前请求体：

```json
{
  "workbookId": "wb_01",
  "prompt": "Analyze sales trends and outliers",
  "sheetNames": ["Sales"],
  "complexity": "normal"
}
```

建议兼容扩展字段：

```json
{
  "workbookId": "wb_01",
  "prompt": "Analyze sales trends and outliers",
  "sheetNames": ["Sales"],
  "regionId": "tbl_sales_1",
  "mode": "auto",
  "complexity": "normal"
}
```

### 字段说明

- `sheetNames`
  - 保留，兼容现有调用
- `regionId`
  - 可选，后续允许用户指定某个候选数据区域
- `mode`
  - `auto | guided`
  - `auto` 表示系统自动规划分析

### 后端任务

- Controller DTO 扩展
- 参数校验
- 兼容老前端不传 `regionId` / `mode`

## 5.2 `GET /api/data-analysis/:id` 改造任务

当前仅要求返回：

- job 状态
- `summaryMd`
- `insights`

建议返回增强结构：

```json
{
  "success": true,
  "data": {
    "job": {
      "id": "an_01",
      "status": "completed",
      "progress": 100
    },
    "result": {
      "summaryMd": "## Revenue trends ...",
      "insights": [],
      "facts": {},
      "dataset": {
        "sheetName": "Sales",
        "regionId": "tbl_sales_1",
        "range": "A1:G1200"
      },
      "qualityWarnings": [],
      "confidenceScore": 0.91,
      "followupSuggestions": []
    }
  }
}
```

### 后端任务

- 修改 `DataAnalysisController.detail()`
- 修改 `JobsService.toAnalysisJobRecord()`
- 将新增字段合并到 `result`

## 5.3 `GET /api/jobs/:id/result` 改造任务

虽然这是通用 Job 接口，但分析任务结果也要走这里。

### 任务

- 确保 `kind=analysis` 时返回增强结果结构
- 保持 Pivot / Chart / Report 结果不受影响

### 验收

- 轮询业务接口和通用结果接口都能拿到完整分析结果

## 5.4 `GET /api/files/:id/preview` 改造任务

该接口是 `Data Analysis` 的上游依赖。

建议在当前返回中增加：

```json
{
  "sheets": [
    {
      "sheetName": "Sales",
      "headers": ["Month", "Region", "Revenue"],
      "columnTypes": ["date", "string", "number"],
      "tableRegions": [],
      "fieldProfiles": [],
      "qualityProfile": {}
    }
  ]
}
```

### 后端任务

- 扩展 `FilesService.toPublicSheet()`
- 保持旧字段不删，避免前端立刻报错

## 6. 后端代码任务拆分

## 6.1 `FilesService`

任务：

- 扩展解析结构
- 写入 `tableRegionsJson`
- 写入 `fieldProfilesJson`
- 写入 `qualityProfileJson`
- 预览接口返回新增字段

涉及文件：

- `backend/src/modules/files/files.service.ts`

## 6.2 新增 `workbook-analysis` 模块

建议新增目录：

- `backend/src/modules/workbook-analysis/`

建议文件：

- `table-region.detector.ts`
- `field-profiler.ts`
- `quality-profiler.ts`
- `analysis-planner.ts`
- `analysis-engine.ts`
- `fact-pack.builder.ts`

职责划分：

- `table-region.detector.ts`
  - 找可分析表格区域
- `field-profiler.ts`
  - 字段类型和语义角色推断
- `quality-profiler.ts`
  - 空值、重复、污染、异常基础检查
- `analysis-planner.ts`
  - 选择要跑哪些分析算子
- `analysis-engine.ts`
  - 真正计算 totals / trends / rankings / anomalies
- `fact-pack.builder.ts`
  - 为 LLM 组装事实包

## 6.3 `DataAnalysisController`

任务：

- 扩展请求参数
- 组装 dataset 输入
- 调用确定性分析引擎
- 再调用 AI 总结

涉及文件：

- `backend/src/modules/data-analysis/data-analysis.controller.ts`

## 6.4 `AiService.generateAnalysis()`

任务：

- 输入从 `summaryMd + sampleRows` 改为 `fact pack + warnings + prompt`
- 保持模型路由逻辑不变
- 输出结构扩展

涉及文件：

- `backend/src/modules/ai/ai.service.ts`

## 6.5 `JobsService`

任务：

- analysis 任务持久化新增字段
- `toAnalysisJobRecord()` 返回增强结果结构

涉及文件：

- `backend/src/modules/jobs/jobs.service.ts`

## 7. 前后端联调任务

## 7.1 前端类型定义

任务：

- 更新 `ToolJobDetail`
- 增加 `AnalysisResult` 类型
- 增加 `FieldProfile` / `QualityWarning` 类型

## 7.2 前端结果区展示

任务：

- 展示 `summaryMd`
- 展示 `insights`
- 展示 `qualityWarnings`
- 展示 `confidenceScore`
- 展示 `followupSuggestions`

### 先不做的内容

- facts 可视化图表
- 证据钻取弹窗
- sheet 内定位跳转

## 8. 兼容性要求

### 8.1 向后兼容

- 老的 `analysis_jobs` 记录没有新增字段时，接口也不能报错
- `GET /api/data-analysis/:id` 需要允许部分字段为 `null`

### 8.2 灰度兼容

在第一版联调期间，允许：

- 部分旧 workbook 没有 `tableRegionsJson`
- 部分旧 workbook 没有 `fieldProfilesJson`

此时系统可降级为：

- 自动从 headers + sampleRows 兜底

但新上传文件必须走新解析链路。

## 9. 测试任务

## 9.1 数据库层测试

- migration 执行成功
- 新字段可写入可读取
- 旧记录查询不报错

## 9.2 API 测试

- `POST /api/data-analysis` 不传 `regionId` 仍可成功
- `POST /api/data-analysis` 传 `regionId` 能定向分析
- `GET /api/data-analysis/:id` 返回增强结果结构
- `GET /api/jobs/:id/result` 返回增强结果结构
- `GET /api/files/:id/preview` 返回字段画像和质量信息

## 9.3 结果质量测试

- 单 sheet 销售表：能输出真实月度趋势
- 汇总表为空：能输出质量告警
- 无时间列：不强行输出时间趋势
- 指标列污染：能提示数值列存在文本污染

## 10. 建议实施顺序

1. 改 Prisma schema
2. 做 migration
3. 扩展 `FilesService`
4. 新增 `workbook-analysis` 模块
5. 改 `DataAnalysisController`
6. 改 `AiService.generateAnalysis()`
7. 改 `JobsService`
8. 改前端类型和结果展示
9. 补测试用例与联调

## 11. 当前最值得先做的数据库与 API 事项

- 先给 `workbook_sheets` 补 `tableRegionsJson / fieldProfilesJson / qualityProfileJson`
- 再给 `analysis_jobs` 补 `factsJson / datasetRefJson / qualityWarningsJson / confidenceScore`
- 最后把 `GET /api/data-analysis/:id` 的返回结构升级

