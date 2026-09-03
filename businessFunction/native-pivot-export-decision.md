# 原生 Pivot 导出技术决策

版本：V1.0  
日期：2026-08-16  
状态：已决策  
决策结论：`NestJS 主服务 + Java Apache POI 导出服务`

关联文档：
- `businessFunction/gptexcel-prd.md`
- `businessFunction/gptexcel-tech-architecture.md`
- `businessFunction/gptexcel-api-spec.md`
- `businessFunction/gptexcel-db-schema.md`

---

## 1. 背景

当前 MVP 的 Pivot Builder 只能返回结构化 JSON 配置，或导出普通汇总结果表。

这能满足“给出建议”的场景，但不能满足以下竞品能力：

- 下载后在 Excel 中仍然是原生可交互 PivotTable
- Excel 内可继续展开 / 折叠 / 拖拽字段
- 带有 `pivotTable` / `pivotCache` 结构，而不是静态汇总 sheet

竞品样例 `sales-small-pivot.xlsx` 已验证包含：

- `xl/pivotTables/pivotTable1.xml`
- `xl/pivotCache/pivotCacheDefinition1.xml`
- `xl/pivotCache/pivotCacheRecords1.xml`

因此，本项目若要真正对标竞品，Pivot Builder 的目标必须从“生成配置”升级为“生成 Excel 原生 PivotTable 文件并可下载”。

---

## 2. 决策结论

选择：

- 主业务服务继续使用 `NestJS`
- 新增一个独立的 `Java Apache POI` 导出服务，专门负责生成 Excel 原生 PivotTable

不选的方案：

- 不继续基于当前 `xlsx / SheetJS` 路线硬做原生 Pivot
- 不把商用品质押在 `ExcelJS` 的实验性 Pivot 能力上
- 不采用 `openpyxl 模板保留` 作为主路线

---

## 3. 选择原因

### 3.1 为什么不是继续用当前 Node 导出

当前 Node 路线适合：

- 上传文件解析
- 生成结构化 pivot 配置
- 导出普通 xlsx 汇总表

但不适合：

- 可靠生成 Excel 原生 Pivot Cache
- 长期维护复杂 OOXML 透视表结构

原因是 PivotTable 不是普通 worksheet 写入问题，而是需要同时生成并关联：

- workbook relation
- source sheet range
- pivotCacheDefinition
- pivotCacheRecords
- pivotTableDefinition

这条链路直接手写 XML 成本高、回归风险大。

### 3.2 为什么选 Apache POI

Apache POI 更适合本项目的原因：

- 支持在服务端生成 Excel 原生 PivotTable
- 可在 Linux / CentOS / Docker 环境运行
- 不依赖本机安装 Excel
- 适合后续扩展更多 Excel 原生对象
  - Pivot Table
  - Chart
  - Named Range
  - Data Validation
  - Formula

### 3.3 为什么拆成独立导出服务

拆服务而不是把 Java 混进 NestJS，原因是：

- 技术栈职责更清晰
- Pivot 导出与登录、配额、AI、支付解耦
- 后续 Charts / Reports 若也要产出复杂 Excel，可复用同一服务
- 导出服务可以单独限流、扩容、重试

---

## 4. 系统边界

### 4.1 NestJS 主服务职责

- 用户登录与鉴权
- 上传工作簿并落盘
- 解析 workbook 预览信息
- 调用 AI 生成 pivot 配置
- 校验额度与记录积分
- 调用 Java 导出服务
- 保存任务结果与下载地址
- 对前端暴露统一 API

### 4.2 Java Apache POI 导出服务职责

- 读取 NestJS 提供的源文件路径或文件流
- 根据 pivot 配置创建原生 PivotTable
- 写出 `.xlsx`
- 返回导出文件的元数据
  - 文件名
  - 文件大小
  - 导出路径
  - 可选的 sheet 名

### 4.3 前端职责

- 提交 Pivot Builder 任务
- 轮询任务状态
- 展示结果卡片
- 提供下载按钮

---

## 5. 推荐调用链路

```text
Frontend
-> POST /api/pivot-builder
-> NestJS 校验登录 / 配额
-> 读取 workbook preview
-> 调用 AI 生成 pivot config
-> 调用 Java Pivot Export Service
-> 生成原生 pivot xlsx
-> NestJS 保存结果与下载地址
-> Frontend 轮询 GET /api/pivot-builder/:id
-> 展示下载按钮
```

---

## 6. 服务间接口建议

Java 服务建议内部接口：

## 6.1 POST /internal/pivot/export

用途：生成 Excel 原生 PivotTable 文件。

请求体建议：

```json
{
  "jobId": "pv_01",
  "userId": "user_01",
  "sourceFilePath": "/data/uploads/user_01/sales-small.csv",
  "sourceFileName": "sales-small.csv",
  "sourceSheetName": "Sales",
  "outputFileName": "sales-small-pivot.xlsx",
  "pivotConfig": {
    "rows": ["Region"],
    "columns": ["Month"],
    "values": [
      {
        "field": "Revenue",
        "aggregation": "sum"
      }
    ],
    "filters": []
  }
}
```

响应体建议：

```json
{
  "success": true,
  "data": {
    "exportFileName": "sales-small-pivot.xlsx",
    "exportFilePath": "/data/exports/pivot/pv_01/sales-small-pivot.xlsx",
    "sheetName": "Pivot",
    "fileSizeBytes": 7168
  }
}
```

### 6.2 错误返回建议

```json
{
  "success": false,
  "error": {
    "code": "PIVOT_EXPORT_FAILED",
    "message": "Failed to create native pivot table."
  }
}
```

---

## 7. NestJS API 口径调整

对外 API 仍保持统一，不让前端直接感知 Java 服务。

## 7.1 POST /api/pivot-builder

返回 job 创建成功即可。

## 7.2 GET /api/pivot-builder/:id

完成后返回：

```json
{
  "success": true,
  "data": {
    "job": {
      "id": "pv_01",
      "status": "completed",
      "progress": 100
    },
    "result": {
      "rows": ["Region"],
      "columns": ["Month"],
      "values": [
        {
          "field": "Revenue",
          "aggregation": "sum"
        }
      ],
      "filters": [],
      "exportFileUrl": "/api/pivot-builder/pv_01/download",
      "exportFileName": "sales-small-pivot.xlsx"
    }
  }
}
```

## 7.3 GET /api/pivot-builder/:id/download

用途：由 NestJS 校验权限后转发或直接返回导出文件。

原因：

- 统一权限控制
- 避免前端直接暴露内部服务地址
- 后续可切换为 S3 预签名链接

---

## 8. 数据模型调整建议

当前 `pivot_jobs` 建议新增：

- `export_file_name`
- `export_file_url`
- `export_file_size_bytes`
- `export_sheet_name`
- `export_status`
- `export_error_message`

说明：

- `config_json` 继续保存 AI 生成的 pivot 配置
- `result_json` 可保存最终前端展示结果
- 原生文件下载信息不要只存在 `result_json` 里，建议落单独列，便于检索和排障

---

## 9. 导出文件存储建议

推荐路径：

```text
storage/exports/pivot/{jobId}/sales-small-pivot.xlsx
```

后续若切到对象存储：

```text
s3://bucket-name/exports/pivot/{jobId}/sales-small-pivot.xlsx
```

建议：

- 开发环境：本地磁盘
- 生产环境：S3 兼容对象存储

---

## 10. 商用级要求

### 10.1 权限

- 下载前必须校验 `job.user_id == current_user.id`
- 不能只靠文件名或路径下载

### 10.2 幂等

- 同一个 `jobId` 重试时，优先覆盖同一路径文件
- 不要重复创建多个同名导出结果

### 10.3 超时与重试

- Java 导出服务调用应设置超时
- NestJS 对导出失败要能标记 `failed`
- 支持任务级重试

### 10.4 可观测性

NestJS 记录：

- aiRequestId
- jobId
- export latency
- export service error

Java 服务记录：

- source file
- selected sheet
- row / column / value fields
- export output path

---

## 11. 开发顺序建议

### Phase 1

- Java 服务 PoC
- 用固定样例文件创建一个原生 PivotTable
- 在 Excel 中验证可交互

### Phase 2

- NestJS 调用 Java 服务
- `pivot_jobs` 增加导出字段
- 前端展示下载按钮

### Phase 3

- 错误重试
- 对象存储
- 生产日志与监控

### Phase 4

- 支持更多聚合方式
- 支持多 value 字段
- 支持更复杂 filters

---

## 12. 当前项目的具体落地建议

建议按以下方式推进：

1. 先保留当前 Node 版“普通汇总 xlsx 导出”，作为临时 fallback
2. 并行新建 Java Pivot Export Service
3. 增加配置开关，例如：

```env
PIVOT_EXPORT_MODE=node_summary
PIVOT_EXPORT_MODE=java_native
PIVOT_EXPORT_SERVICE_URL=http://127.0.0.1:8085
```

4. 待 Java 服务通过联调后，把默认模式切到 `java_native`

这样好处是：

- 开发不中断
- 可以灰度切换
- 即使 Java 服务未就绪，Pivot Builder 也不会完全不可用

---

## 13. 最终结论

本项目若要真正对标竞品的 Pivot Builder 下载体验，应采用：

- `NestJS 主服务 + Java Apache POI 导出服务`

这是当前最稳妥、最适合商用的路线。

后续实现中，NestJS 负责：

- 业务编排
- AI 配置生成
- 权限和计费
- 统一 API

Java 服务负责：

- 生成 Excel 原生 PivotTable
- 输出最终可下载的 `.xlsx`

该决策自 2026-08-16 起冻结，后续开发按此路线推进。
