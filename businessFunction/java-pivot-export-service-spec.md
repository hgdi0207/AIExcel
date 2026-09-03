# Java Pivot Export Service 详细设计

版本：V1.0  
日期：2026-08-16  
状态：待开发  
适用范围：`NestJS 主服务 + Java Apache POI 导出服务` 架构下的原生 PivotTable 导出能力

关联文档：
- `businessFunction/native-pivot-export-decision.md`
- `businessFunction/gptexcel-tech-architecture.md`
- `businessFunction/gptexcel-api-spec.md`
- `businessFunction/gptexcel-db-schema.md`

---

## 1. 文档目标

本文档用于定义 Java Pivot Export Service 的：

- 服务职责
- 技术选型
- HTTP 接口
- 请求与响应结构
- 文件存储规则
- 错误处理
- 部署方式
- 与 NestJS 的联调口径

目标是让后端开发可以直接开始实现，不再停留在技术选型讨论阶段。

---

## 2. 服务定位

Java Pivot Export Service 是一个内部导出服务，只对 NestJS 主服务开放，不直接给前端调用。

它负责：

- 读取源工作簿
- 生成 Excel 原生 PivotTable
- 写出最终 `.xlsx`
- 返回导出文件元数据

它不负责：

- 用户登录
- 前端页面
- AI 调用
- 配额扣减
- 订阅与支付

这些仍由 NestJS 主服务负责。

---

## 3. 技术选型

建议：

- 语言：Java 21
- 框架：Spring Boot 3
- Excel 库：Apache POI
- 构建工具：Maven
- 运行方式：独立 Docker 容器

原因：

- Spring Boot 启动快，适合做内部 HTTP 服务
- Apache POI 适合生成 Excel 原生 PivotTable
- Java 21 适合长期维护
- 独立容器部署便于后续单独扩容

---

## 4. 服务边界

### 4.1 输入

来自 NestJS 的请求应包含：

- jobId
- userId
- sourceFilePath 或 sourceFileUrl
- sourceFileName
- sourceSheetName
- 输出文件名
- pivotConfig

### 4.2 输出

返回：

- exportFileName
- exportFilePath
- sheetName
- fileSizeBytes

### 4.3 权限边界

Java 服务不做用户级权限判断。

它只信任来自 NestJS 的内部调用。

因此：

- 对外网不可直接开放
- 必须通过内网访问
- 必须校验内部服务签名或共享密钥

---

## 5. 推荐模块结构

建议模块：

- `PivotExportController`
- `PivotExportService`
- `WorkbookLoader`
- `PivotBuilderService`
- `ExportStorageService`
- `SecurityFilter`
- `HealthController`

职责划分：

- `Controller` 处理 HTTP
- `WorkbookLoader` 加载源文件
- `PivotBuilderService` 生成 PivotTable
- `ExportStorageService` 写文件与返回元数据
- `SecurityFilter` 校验内部签名

---

## 6. API 设计

## 6.1 POST /internal/pivot/export

用途：生成原生 PivotTable 文件。

鉴权：内部服务鉴权

请求头建议：

```text
Content-Type: application/json
X-Internal-Service: nest-backend
X-Internal-Token: ${PIVOT_EXPORT_SHARED_TOKEN}
X-Request-Id: req_01
```

请求体：

```json
{
  "jobId": "pv_01",
  "userId": "user_01",
  "sourceFilePath": "E:/app/storage/local/uploads/user_01/1723824000000-sales-small.csv",
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

成功响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "exportFileName": "sales-small-pivot.xlsx",
    "exportFilePath": "/data/exports/pivot/pv_01/sales-small-pivot.xlsx",
    "sheetName": "Pivot",
    "fileSizeBytes": 7168
  }
}
```

失败响应：

```json
{
  "success": false,
  "requestId": "req_01",
  "error": {
    "code": "PIVOT_EXPORT_FAILED",
    "message": "Failed to create native pivot table."
  }
}
```

## 6.2 GET /internal/health

用途：健康检查。

响应：

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

---

## 7. 请求字段定义

### 7.1 顶层字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| jobId | string | 是 | Pivot 任务 ID |
| userId | string | 是 | 用户 ID |
| sourceFilePath | string | 是 | NestJS 已落盘的源文件路径 |
| sourceFileName | string | 是 | 原始文件名 |
| sourceSheetName | string | 否 | 优先使用的 sheet |
| outputFileName | string | 是 | 输出文件名 |
| pivotConfig | object | 是 | Pivot 配置 |

### 7.2 pivotConfig 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| rows | string[] | 否 | 行字段 |
| columns | string[] | 否 | 列字段 |
| values | object[] | 是 | 值字段 |
| filters | object[] | 否 | 筛选条件 |

### 7.3 values 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| field | string | 是 | 聚合字段 |
| aggregation | string | 是 | `sum` / `avg` / `count` / `min` / `max` |

### 7.4 filters 字段

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| field | string | 是 | 字段名 |
| operator | string | 是 | 比较符 |
| value | string | 是 | 比较值 |

---

## 8. 处理流程

```text
Receive Request
-> Validate Internal Token
-> Validate Request Body
-> Load Workbook
-> Find Source Sheet
-> Normalize Data Range
-> Build Raw Data Sheet if needed
-> Create Pivot Cache
-> Create Pivot Table
-> Save Workbook
-> Return Export Metadata
```

说明：

- 若源文件是 `.csv`，服务内部需先构造成 workbook
- 若原始 sheet 不适合直接做 pivot，可先复制到隐藏的 raw data sheet
- 最终输出的 workbook 至少包含：
  - 原始数据 sheet
  - Pivot sheet

---

## 9. 文件规则

### 9.1 输出路径

建议：

```text
/data/exports/pivot/{jobId}/{outputFileName}
```

示例：

```text
/data/exports/pivot/pv_01/sales-small-pivot.xlsx
```

### 9.2 文件命名

建议规则：

- 基于原文件名去扩展名
- 追加 `-pivot`
- 扩展名固定 `.xlsx`

例如：

- `sales-small.csv` -> `sales-small-pivot.xlsx`
- `revenue_2026.xlsx` -> `revenue_2026-pivot.xlsx`

### 9.3 覆盖策略

同一个 `jobId` 重试时：

- 允许覆盖同一路径文件
- 不生成多个同名版本

---

## 10. 安全设计

### 10.1 内部鉴权

环境变量：

```env
PIVOT_EXPORT_SHARED_TOKEN=change-me
```

NestJS 调用时带：

```text
X-Internal-Token: ${PIVOT_EXPORT_SHARED_TOKEN}
```

Java 服务校验不通过时返回 `401`。

### 10.2 文件访问

Java 服务只负责生成文件，不负责把文件直接暴露给浏览器。

浏览器下载时仍走：

```text
GET /api/pivot-builder/:id/download
```

由 NestJS 做用户权限校验。

### 10.3 路径安全

Java 服务不接受任意路径拼接。

要求：

- `sourceFilePath` 必须在允许目录前缀内
- `outputFileName` 需过滤非法字符
- 输出目录必须固定在服务配置的导出根目录下

---

## 11. 错误码设计

| code | 含义 |
|---|---|
| UNAUTHORIZED | 内部鉴权失败 |
| INVALID_ARGUMENT | 参数不合法 |
| SOURCE_FILE_NOT_FOUND | 源文件不存在 |
| SOURCE_SHEET_NOT_FOUND | 源 sheet 不存在 |
| UNSUPPORTED_FILE_TYPE | 文件类型不支持 |
| PIVOT_CONFIG_INVALID | Pivot 配置不合法 |
| PIVOT_EXPORT_FAILED | 生成失败 |
| OUTPUT_WRITE_FAILED | 输出文件写入失败 |
| INTERNAL_ERROR | 服务内部错误 |

---

## 12. NestJS 调用方式建议

NestJS 内部建议新增：

- `PivotNativeExportClient`

职责：

- 组装请求体
- 调 Java 服务
- 处理超时
- 解析错误码

环境变量建议：

```env
PIVOT_EXPORT_MODE=java_native
PIVOT_EXPORT_SERVICE_URL=http://127.0.0.1:8085
PIVOT_EXPORT_SHARED_TOKEN=change-me
PIVOT_EXPORT_TIMEOUT_MS=30000
```

调用失败时策略：

- 标记 `pivot_jobs.export_status=failed`
- 写入 `export_error_message`
- job 状态可保持 `failed`

---

## 13. Docker 部署建议

### 13.1 端口

- 服务端口：`8085`

### 13.2 容器挂载

建议挂载：

```text
/data/uploads
/data/exports
```

这样 NestJS 与 Java 服务可共享文件目录，避免额外传文件流。

### 13.3 最小部署拓扑

```text
frontend
-> nestjs-backend
-> java-pivot-export-service

postgres
redis
shared-volume
```

---

## 14. 开发顺序

### Phase 1

- Spring Boot 服务骨架
- `/internal/health`
- `/internal/pivot/export`
- 固定样例文件导出

### Phase 2

- 接入 Apache POI 原生 PivotTable
- 生成真实 Pivot Cache
- 输出可打开的 `.xlsx`

### Phase 3

- 与 NestJS 联调
- 增加错误码
- 增加日志

### Phase 4

- Docker 化
- Linux 路径联调
- 压测与回归

---

## 15. 验收标准

- Java 服务可接收 NestJS 调用
- 输出文件可被 Excel 正常打开
- 文件内部包含 `pivotTables` / `pivotCache` 相关结构
- NestJS 能返回 `exportFileUrl`
- 前端可下载生成文件
- 用户权限校验正确
- 导出失败有明确错误记录

---

## 16. 最终结论

Java Pivot Export Service 是本项目原生 PivotTable 能力的核心组件。

后续开发应按本文档实现，并保持以下原则：

- 不让前端直接访问 Java 服务
- 不让 Java 服务承担用户业务逻辑
- 所有对外下载必须回到 NestJS 做权限判断

该文档自 2026-08-16 起生效。
