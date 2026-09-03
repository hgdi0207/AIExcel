# Data Analysis 开发任务清单

版本：V1.0  
日期：2026-08-19  
依据：
- `businessFunction/data-analysis-generic-architecture.md`
- `businessFunction/gptexcel-prd.md`
- `businessFunction/gptexcel-api-spec.md`

## 1. 目标

把 `Data Analysis` 从“样本摘要 + 模型总结”升级为：

- 通用 Excel/CSV 分析
- 可验证的程序化统计
- 结构化结果输出
- 可继续流转到 Charts / Reports

## 2. 开发原则

- 先做可验证事实，再做 AI 表达
- 先支持常见结构化表，再处理复杂布局
- 结果必须可复核、可追踪、可降级
- 不依赖固定模板

## 3. 第一阶段：基础能力补齐

### 3.1 文件解析增强

后端任务：

- 扩展 `FilesService` 的解析结果
- 保存 `columnTypesJson`
- 保存 `formulaColumnsJson`
- 保存 `tableRegionsJson`
- 保存 `qualityProfileJson`

验收：

- 上传后不只返回 headers 和 sampleRows
- 预览接口能看到字段类型和基础质量信息

### 3.2 表格区域识别

后端任务：

- 新增 `TableRegionDetector`
- 支持单 sheet 主表识别
- 支持候选区域输出
- 排除空行、装饰块、备注块

验收：

- 任意常见表格文件可找到主分析区域
- 找不到时返回明确原因

### 3.3 字段画像

后端任务：

- 新增 `FieldProfiler`
- 识别维度列、指标列、时间列、ID 列
- 计算 non-null ratio、distinct count、min/max/mean

验收：

- 能识别 Revenue、Month、Region 这类常见字段角色

### 3.4 数据质量检查

后端任务：

- 新增质量扫描
- 检测空值率、重复行、脏数值、不可解析日期
- 输出质量告警

验收：

- 空表、坏表、汇总缺失能被明确提示

## 4. 第二阶段：分析引擎

### 4.1 统计算子

后端任务：

- 实现 `overall_summary`
- 实现 `group_aggregate`
- 实现 `time_series_trend`
- 实现 `ranking_top_n`
- 实现 `ranking_bottom_n`
- 实现 `outlier_iqr`

验收：

- 可以稳定产出趋势、汇总、排名、异常

### 4.2 分析规划器

后端任务：

- 新增 `AnalysisPlanner`
- 根据 prompt + 字段画像选择算子
- 自动模式下可生成默认分析任务集

验收：

- 不写 prompt 也能自动分析
- 写明确问题时能定向分析

### 4.3 事实包输出

后端任务：

- 新增 `FactPackBuilder`
- 把统计结果整理成统一结构
- 为 LLM 提供证据和置信度

验收：

- LLM 输入变成结构化事实，不再只靠 sampleRows

## 5. 第三阶段：AI 层改造

### 5.1 `AiService.generateAnalysis()` 改造

后端任务：

- 输入改为 `workbook summary + dataset facts + quality warnings + user prompt`
- 保留 `gpt-5.6-terra` 默认路由
- 复杂分析切 `gpt-5.6-sol`

验收：

- 分析结果更稳定
- 模型输出更贴近事实

### 5.2 结果结构扩展

后端任务：

- `summaryMd`
- `insights`
- `facts`
- `qualityWarnings`
- `confidenceScore`
- `followupSuggestions`

验收：

- 前端可直接展示结构化分析结果

## 6. 第四阶段：API 与前端

### 6.1 API 调整

后端任务：

- 保持 `POST /api/data-analysis`
- 扩展 `GET /api/data-analysis/:id`
- 扩展 `GET /api/jobs/:id/result`

验收：

- 任务创建、轮询、结果获取流程稳定

### 6.2 前端页面

前端任务：

- Data Analysis 页支持选择 workbook
- 支持 prompt 输入
- 支持自动模式
- 支持结果区展示 summary / insights / warnings

验收：

- 用户能完成“上传 -> 分析 -> 查看结果”

## 7. 第五阶段：联动与体验

### 7.1 与 Charts 联动

任务：

- 从分析结果一键跳转 Charts
- 自动带出候选字段

### 7.2 与 Reports 联动

任务：

- 从分析结果一键跳转 Reports
- 自动带出摘要和洞察

### 7.3 失败降级

任务：

- 数据质量差时给出解释
- 无法识别主表时给出候选 sheet
- 大文件时优先聚合后再入模

## 8. 推荐实施顺序

1. 文件解析增强
2. 表格区域识别
3. 字段画像
4. 质量检查
5. 分析算子
6. 事实包
7. LLM 改造
8. 前端结果展示
9. Charts / Reports 联动

## 9. 当前最先做的 3 件事

- 把 `FilesService` 的解析结果补全
- 把 `Data Analysis` 改成事实驱动
- 把前端结果区做成结构化展示

