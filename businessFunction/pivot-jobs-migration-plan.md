# pivot_jobs 字段调整与迁移方案

版本：V1.0  
日期：2026-08-16  
状态：待开发  
适用范围：为原生 PivotTable 导出能力补充 `pivot_jobs` 存储结构

关联文档：
- `businessFunction/native-pivot-export-decision.md`
- `businessFunction/java-pivot-export-service-spec.md`
- `businessFunction/gptexcel-db-schema.md`
- `businessFunction/gptexcel-api-spec.md`

---

## 1. 文档目标

本文档用于定义：

- `pivot_jobs` 表需要新增哪些字段
- 为什么不能只把导出信息塞进 `result_json`
- Prisma Schema 应如何调整
- PostgreSQL 迁移 SQL 应如何编写
- 如何灰度上线而不影响当前功能

目标是让数据库、后端、联调三方按同一口径推进。

---

## 2. 变更背景

当前 `pivot_jobs` 只适合保存：

- prompt
- config_json
- result_json
- status
- ai_request_id

但当 Pivot Builder 升级为“生成并下载原生 PivotTable 文件”后，仅靠 `result_json` 不够。

原因：

- 导出状态需要单独检索
- 导出错误需要单独排查
- 文件大小和文件名不适合只存在 JSON 里
- 后续对象存储切换需要稳定字段

因此建议为 `pivot_jobs` 增加导出相关列。

---

## 3. 目标字段设计

建议新增字段：

| 字段 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| export_file_name | varchar(255) | 否 |  | 导出文件名 |
| export_file_url | text | 否 |  | 对前端暴露的下载地址 |
| export_file_size_bytes | bigint | 否 |  | 导出文件大小 |
| export_sheet_name | varchar(255) | 否 |  | 导出的 Pivot sheet 名 |
| export_status | varchar(32) | 否 | `pending` | `pending` / `completed` / `failed` |
| export_error_message | text | 否 |  | 导出错误信息 |
| export_started_at | timestamptz | 否 |  | 导出开始时间 |
| export_completed_at | timestamptz | 否 |  | 导出完成时间 |

---

## 4. 字段用途说明

### 4.1 export_file_name

用于：

- 前端展示文件名
- 下载响应头文件名
- 排障时识别导出物

示例：

- `sales-small-pivot.xlsx`

### 4.2 export_file_url

用于：

- 前端下载按钮
- 统一暴露 `/api/pivot-builder/:id/download`

注意：

- 不建议直接保存 Java 服务内网地址
- 建议保存 NestJS 下载路由

### 4.3 export_file_size_bytes

用于：

- 前端展示文件大小
- 运维判断文件是否异常过小

### 4.4 export_sheet_name

用于：

- 记录最终生成的 Pivot sheet
- 便于回归验证

### 4.5 export_status

用于：

- 区分 AI 配置生成成功但导出失败的情况
- 便于灰度迁移

推荐值：

- `pending`
- `completed`
- `failed`

### 4.6 export_error_message

用于：

- 记录 Java 服务返回的导出错误
- 便于直接在后台排障

### 4.7 export_started_at / export_completed_at

用于：

- 计算导出耗时
- 后续做 SLA 统计

---

## 5. 为什么不只存 result_json

不推荐仅存：

```json
{
  "exportFileUrl": "...",
  "exportFileName": "...",
  "exportStatus": "completed"
}
```

原因：

- 查询导出失败任务不方便
- SQL 层筛选字段复杂
- 索引能力差
- 不利于后续报表和监控

推荐方案：

- `result_json` 负责前端展示结构
- 独立字段负责导出元数据和状态

---

## 6. Prisma Schema 调整建议

建议在 `PivotJob` 模型增加：

```prisma
exportFileName      String?   @map("export_file_name") @db.VarChar(255)
exportFileUrl       String?   @map("export_file_url")
exportFileSizeBytes BigInt?   @map("export_file_size_bytes")
exportSheetName     String?   @map("export_sheet_name") @db.VarChar(255)
exportStatus        String?   @map("export_status") @db.VarChar(32)
exportErrorMessage  String?   @map("export_error_message")
exportStartedAt     DateTime? @map("export_started_at") @db.Timestamptz(6)
exportCompletedAt   DateTime? @map("export_completed_at") @db.Timestamptz(6)
```

说明：

- 先用字符串，避免过早引入数据库 enum
- 与当前 schema 风格保持一致

---

## 7. PostgreSQL 迁移 SQL 建议

建议迁移名：

```text
20260816_add_pivot_export_columns
```

建议 SQL：

```sql
ALTER TABLE pivot_jobs
ADD COLUMN export_file_name varchar(255),
ADD COLUMN export_file_url text,
ADD COLUMN export_file_size_bytes bigint,
ADD COLUMN export_sheet_name varchar(255),
ADD COLUMN export_status varchar(32) DEFAULT 'pending',
ADD COLUMN export_error_message text,
ADD COLUMN export_started_at timestamptz,
ADD COLUMN export_completed_at timestamptz;

CREATE INDEX idx_pivot_jobs_export_status ON pivot_jobs(export_status);
```

说明：

- `export_status` 给默认值 `pending`
- 旧数据不需要立即回填文件信息
- 增加索引，便于排查导出失败任务

---

## 8. 旧数据兼容策略

当前已有的 `pivot_jobs` 历史记录没有导出字段。

兼容策略：

- 历史行默认 `export_status = pending`
- 当前前端渲染时：
  - 若没有 `export_file_url`，则不显示下载按钮
  - 若只有 `result_json`，仍可显示 JSON 结果

这样可以保证：

- 老数据不报错
- 新数据可逐步切换到原生导出模式

---

## 9. 后端写入时机

建议时机：

### 9.1 创建 job 时

写入：

- `status = queued`
- `export_status = pending`

### 9.2 开始调用 Java 服务前

写入：

- `export_started_at = now()`

### 9.3 导出成功后

写入：

- `export_file_name`
- `export_file_url`
- `export_file_size_bytes`
- `export_sheet_name`
- `export_status = completed`
- `export_completed_at = now()`

### 9.4 导出失败后

写入：

- `export_status = failed`
- `export_error_message`

---

## 10. 状态组合建议

需要明确两层状态：

- job 主状态：`queued / running / completed / failed`
- export 状态：`pending / completed / failed`

推荐解释：

| job.status | export_status | 含义 |
|---|---|---|
| queued | pending | 任务已创建 |
| running | pending | AI 或导出处理中 |
| failed | failed | 导出失败或流程失败 |
| completed | completed | 最终文件已生成 |

不建议出现：

- `completed + pending`

这会让前端无法判断是否可下载。

---

## 11. 灰度切换方案

建议增加配置：

```env
PIVOT_EXPORT_MODE=node_summary
PIVOT_EXPORT_MODE=java_native
```

灰度步骤：

1. 先发数据库迁移
2. 后端先兼容新字段，但仍用 `node_summary`
3. Java 服务联调完成后，切换到 `java_native`
4. 前端优先读 `export_file_url`
5. 若 Java 服务异常，可临时回退到 `node_summary`

这样可以避免：

- 一次性切换失败
- 数据结构先发后端无法读取

---

## 12. 前端联调口径

前端读取 `GET /api/pivot-builder/:id` 时，建议按以下逻辑：

1. 若 `result.exportFileUrl` 存在，显示下载按钮
2. 若不存在，则显示 JSON 或占位结果
3. 若 `job.status = failed`，显示错误提示

后续若要做更像竞品的卡片样式，可直接使用：

- `exportFileName`
- `exportFileUrl`
- `exportFileSizeBytes`

---

## 13. 测试建议

数据库迁移后建议验证：

1. 新建 Pivot 任务时新增列默认值正确
2. Java 导出成功后相关字段已写入
3. 导出失败时 `export_status=failed`
4. 历史数据查询不报错
5. 前端旧任务不显示下载按钮

---

## 14. 回滚方案

若 Java 服务联调未通过：

- 不回滚字段
- 仅回退 `PIVOT_EXPORT_MODE=node_summary`

原因：

- 新字段向后兼容
- 保留字段不会影响旧功能
- 回滚数据库字段收益不大，风险更高

---

## 15. 开发任务拆分建议

### 后端

- 更新 Prisma Schema
- 生成 migration
- 更新 `jobs.service`
- 更新 `pivot-builder.controller`
- 增加导出状态写入

### Java 服务

- 按接口返回导出元数据
- 明确成功 / 失败响应结构

### 前端

- 读取下载地址
- 渲染下载按钮
- 显示文件名与大小

---

## 16. 最终结论

`pivot_jobs` 需要从“只记录 AI 结果”升级为“记录 AI 结果 + 导出文件元数据 + 导出状态”。

推荐做法是：

- 保留 `config_json` / `result_json`
- 新增独立导出字段
- 通过灰度模式切换到 Java 原生导出

该方案自 2026-08-16 起作为后续数据库与后端改造依据。
