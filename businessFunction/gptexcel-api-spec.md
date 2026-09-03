# GPTExcel 类产品 API 详细设计

版本：V1.0  
日期：2026-08-10  
关联文档：
- `businessFunction/gptexcel-prd.md`
- `businessFunction/gptexcel-tech-architecture.md`
- `businessFunction/gptexcel-db-schema.md`

## 1. 文档目标

本文档定义 MVP 阶段 API 的：

- 路由
- 鉴权要求
- 请求参数
- 响应结构
- 错误码
- 典型业务约束

目标是让前后端可以并行开发。

## 2. API 基础约定

## 2.1 Base URL

- 开发环境：`/api`
- 生产环境：`https://your-domain.com/api`

## 2.2 认证方式

- 登录方式：Google / Microsoft OAuth
- 业务接口认证：HttpOnly JWT Cookie（access_token + refresh_token）
- 除登录回调、Webhook 外，所有接口都要求登录

说明：

- 前端请求业务接口时必须携带 `credentials: include`
- `401` 时前端先调用刷新接口，刷新失败再跳转登录页
- 不建议在前端保存可读 JWT

## 2.3 Content-Type

- JSON 接口：`application/json`
- 文件上传：`multipart/form-data`
- 流式接口：`text/event-stream`

## 2.4 通用响应结构

成功：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {}
}
```

失败：

```json
{
  "success": false,
  "requestId": "req_01",
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Not enough credits."
  }
}
```

## 2.5 常用状态码

- `200` 成功
- `201` 创建成功
- `400` 参数错误
- `401` 未登录
- `403` 无权限
- `404` 资源不存在
- `409` 状态冲突
- `413` 文件过大
- `422` 业务校验失败
- `429` 频率或额度受限
- `500` 服务内部错误

## 3. 通用错误码

| code | 含义 |
|---|---|
| UNAUTHORIZED | 未登录或会话失效 |
| FORBIDDEN | 无权限访问资源 |
| INVALID_ARGUMENT | 参数不合法 |
| RESOURCE_NOT_FOUND | 资源不存在 |
| FILE_TOO_LARGE | 文件超出限制 |
| FILE_TYPE_NOT_SUPPORTED | 文件类型不支持 |
| WORKBOOK_PARSE_FAILED | 工作簿解析失败 |
| QUOTA_EXCEEDED | 额度不足 |
| SUBSCRIPTION_REQUIRED | 需要升级套餐 |
| AI_PROVIDER_ERROR | AI 服务调用失败 |
| INVALID_JOB_STATUS | 当前任务状态不允许此操作 |
| EXPORT_FAILED | 导出失败 |
| INTERNAL_ERROR | 服务内部错误 |

## 4. Auth API

## 4.1 GET /api/auth/google

用途：发起 Google OAuth 登录。

鉴权：否

请求参数：无

响应：

- `302` 跳转到 Google 授权页

## 4.2 GET /api/auth/microsoft

用途：发起 Microsoft OAuth 登录。

鉴权：否

请求参数：无

响应：

- `302` 跳转到 Microsoft 授权页

## 4.3 GET /api/auth/google/callback

用途：处理 Google OAuth 回调。

鉴权：否

查询参数：

| 参数 | 必填 | 说明 |
|---|---|---|
| code | 是 | OAuth 授权码 |
| state | 是 | 防重放 state |

响应：

- `302` 登录成功后跳转 `/dashboard`

成功时后端会同时签发：

- `access_token` HttpOnly Cookie
- `refresh_token` HttpOnly Cookie

失败：

- `401 UNAUTHORIZED`

## 4.4 GET /api/auth/microsoft/callback

用途：处理 Microsoft OAuth 回调。

鉴权：否

查询参数同上。

响应：

- `302` 登录成功后跳转 `/dashboard`

成功时后端会同时签发：

- `access_token` HttpOnly Cookie
- `refresh_token` HttpOnly Cookie

## 4.5 POST /api/auth/refresh

用途：刷新登录态。

鉴权：否

说明：

- 仅依赖 `refresh_token` Cookie
- 刷新成功后重新签发 `access_token`

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "refreshed": true
  }
}
```

## 4.6 POST /api/auth/logout

用途：登出。

鉴权：是

请求体：无

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "loggedOut": true
  }
}
```

## 4.7 GET /api/auth/me

用途：获取当前用户信息。

鉴权：是

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "user": {
      "id": "usr_01",
      "email": "demo@example.com",
      "name": "Demo User",
      "avatarUrl": "https://...",
      "plan": "free",
      "locale": "en"
    }
  }
}
```

## 5. Workbook API

## 5.1 POST /api/files/upload

用途：上传 Excel / CSV 并触发解析。

鉴权：是

Content-Type：`multipart/form-data`

表单字段：

| 字段 | 必填 | 类型 | 说明 |
|---|---|---|---|
| file | 是 | binary | `.xlsx` / `.xls` / `.csv` |

业务规则：

- Free 用户文件上限 `5MB`
- Pro 用户文件上限 `50MB`
- Pro Plus 用户文件上限 `100MB`
- 仅接受 `.xlsx`、`.xls`、`.csv`
- MIME 需匹配电子表格类型，拒绝未知二进制文件

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "workbook": {
      "id": "wb_01",
      "fileName": "sales.xlsx",
      "status": "parsing",
      "fileType": "xlsx",
      "fileSizeBytes": 1048576
    }
  }
}
```

失败：

- `413 FILE_TOO_LARGE`
- `422 FILE_TYPE_NOT_SUPPORTED`

## 5.2 GET /api/files/:id/preview

用途：获取工作簿预览与解析结果。

鉴权：是

路径参数：

| 参数 | 必填 | 说明 |
|---|---|---|
| id | 是 | workbook id |

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "workbook": {
      "id": "wb_01",
      "status": "ready",
      "fileName": "sales.xlsx",
      "sheetCount": 2,
      "summaryMd": "## Workbook Summary..."
    },
    "sheets": [
      {
        "id": "sheet_01",
        "sheetName": "Sheet1",
        "sheetIndex": 0,
        "headers": ["Date", "Revenue", "Region"],
        "sampleRows": [
          ["2026-01-01", 1200, "APAC"]
        ],
        "rowCount": 120,
        "columnCount": 3
      }
    ]
  }
}
```

失败：

- `404 RESOURCE_NOT_FOUND`
- `422 WORKBOOK_PARSE_FAILED`

## 5.3 GET /api/files

用途：获取当前用户工作簿列表。

鉴权：是

查询参数：

| 参数 | 必填 | 说明 |
|---|---|---|
| page | 否 | 默认 1 |
| pageSize | 否 | 默认 20，最大 100 |
| status | 否 | `uploaded/parsing/ready/failed` |

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 0
    }
  }
}
```

## 6. Spreadsheet Assistant API

## 6.1 GET /api/assistant/threads

用途：获取会话列表。

鉴权：是

查询参数：

| 参数 | 必填 | 说明 |
|---|---|---|
| workbookId | 否 | 按工作簿筛选 |

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "items": [
      {
        "id": "thr_01",
        "title": "Monthly sales questions",
        "workbookId": "wb_01",
        "updatedAt": "2026-08-10T12:00:00Z"
      }
    ]
  }
}
```

## 6.2 POST /api/assistant/threads

用途：创建新会话。

鉴权：是

请求体：

```json
{
  "title": "Optional title",
  "workbookId": "wb_01"
}
```

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "thread": {
      "id": "thr_01",
      "title": "Optional title",
      "workbookId": "wb_01"
    }
  }
}
```

## 6.3 GET /api/assistant/threads/:id/messages

用途：获取会话消息。

鉴权：是

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "thread": {
      "id": "thr_01",
      "title": "Monthly sales questions"
    },
    "messages": [
      {
        "id": "msg_01",
        "role": "user",
        "content": "Summarize the workbook",
        "createdAt": "2026-08-10T12:00:00Z"
      }
    ]
  }
}
```

## 6.4 POST /api/assistant/threads/:id/messages/stream

用途：发送消息并流式返回助手回答。

鉴权：是

请求体：

```json
{
  "content": "What are the main revenue trends?",
  "workbookId": "wb_01",
  "sheetNames": ["Sheet1"],
  "cellRanges": ["A1:D120"]
}
```

业务规则：

- 校验用户是否有剩余额度
- 默认走 `gpt-5.6-luna`
- 复杂问题可由后端路由至 `gpt-5.6-terra`
- 响应必须使用 SSE，`Content-Type: text/event-stream`
- 前端应按 chunk 渲染，不等完整回答结束再展示

SSE 事件示例：

```text
event: message.delta
data: {"messageId":"msg_02","delta":"Revenue increased steadily..."}

event: message.complete
data: {"messageId":"msg_02","aiRequestId":"air_01","creditsConsumed":1}

event: error
data: {"code":"AI_PROVIDER_ERROR","message":"Upstream model error"}
```

失败：

- `429 QUOTA_EXCEEDED`
- `404 RESOURCE_NOT_FOUND`

## 7. Pivot Builder API

## 7.1 POST /api/pivot-builder

用途：创建透视表任务，并最终生成可下载的原生 PivotTable 文件。

鉴权：是

请求体：

```json
{
  "workbookId": "wb_01",
  "sheetName": "Sales",
  "prompt": "Build a pivot by region and month, sum revenue."
}
```

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "job": {
      "id": "pv_01",
      "status": "queued",
      "creditsConsumed": 4
    },
    "polling": true
  }
}
```

## 7.2 GET /api/pivot-builder/:id

用途：获取透视任务详情。

鉴权：是

响应：

```json
{
  "success": true,
  "requestId": "req_01",
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

用途：下载生成好的 PivotTable 文件。

鉴权：是

说明：

- 由后端先校验任务归属，再返回文件
- 前端不应直接暴露内部导出服务地址

响应：

- `200` 文件流下载
- `404 RESOURCE_NOT_FOUND` 文件不存在
- `409 INVALID_JOB_STATUS` 任务尚未完成

## 8. Data Analysis API

## 8.1 POST /api/data-analysis

用途：创建数据分析任务。

鉴权：是

请求体：

```json
{
  "workbookId": "wb_01",
  "prompt": "Analyze sales trends and outliers",
  "sheetNames": ["Sales"],
  "complexity": "normal"
}
```

说明：

- `complexity=normal` 默认 `gpt-5.6-terra`
- `complexity=complex` 可路由 `gpt-5.6-sol`
- 该接口返回 Job，不等待完整分析完成
- 前端可轮询 `GET /api/jobs/:id/status` 和 `GET /api/jobs/:id/result`
- 如需进度推送，可额外订阅 `GET /api/jobs/:id/stream`

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "job": {
      "id": "an_01",
      "status": "queued",
      "creditsConsumed": 0
    },
    "polling": true
  }
}
```

## 8.2 GET /api/data-analysis/:id

用途：获取分析任务详情。

鉴权：是

响应结构同上，包含任务状态与结果；完成前仅返回状态，完成后返回 `summaryMd` 和 `insights`。

## 8.3 GET /api/jobs/:id/status

用途：获取通用 Job 状态。

鉴权：是

响应示例：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "jobId": "an_01",
    "status": "running",
    "progress": 45
  }
}
```

## 8.4 GET /api/jobs/:id/result

用途：获取通用 Job 结果。

鉴权：是

说明：

- 仅当 `status=completed` 时返回结果
- 未完成返回 `409 INVALID_JOB_STATUS`

## 8.5 GET /api/jobs/:id/stream

用途：通过 SSE 推送 Job 进度。

鉴权：是

响应：

- `Content-Type: text/event-stream`
- 可推送 `job.progress`、`job.complete`、`job.error`

示例：

```text
event: job.progress
data: {"jobId":"an_01","progress":45}

event: job.complete
data: {"jobId":"an_01","status":"completed"}
```

## 9. Charts API

## 9.1 POST /api/charts

用途：生成图表建议与配置。

鉴权：是

请求体：

```json
{
  "workbookId": "wb_01",
  "analysisJobId": "an_01",
  "prompt": "Create a line chart for monthly revenue",
  "preferredChartType": "line"
}
```

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "job": {
      "id": "ch_01",
      "status": "completed",
      "creditsConsumed": 5
    },
    "chart": {
      "chartType": "line",
      "title": "Monthly Revenue",
      "xAxis": "Month",
      "yAxis": "Revenue",
      "config": {}
    }
  }
}
```

## 9.2 GET /api/charts/:id

用途：获取图表任务详情。

鉴权：是

## 10. Reports API

## 10.1 POST /api/reports

用途：创建报告任务。

鉴权：是

请求体：

```json
{
  "workbookId": "wb_01",
  "analysisJobId": "an_01",
  "prompt": "Create an executive summary report",
  "format": "md",
  "complexity": "normal"
}
```

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "job": {
      "id": "rp_01",
      "status": "queued",
      "creditsConsumed": 0
    },
    "polling": true
  }
}
```

## 10.2 GET /api/reports/:id

用途：获取报告任务详情。

鉴权：是

完成前仅返回状态，完成后返回 `contentMd` / `exportFileUrl`。

## 10.3 POST /api/reports/:id/export

用途：导出报告文件。

鉴权：是

请求体：

```json
{
  "format": "pdf"
}
```

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "fileUrl": "https://storage.example.com/reports/rp_01.pdf"
  }
}
```

失败：

- `422 EXPORT_FAILED`

## 11. Billing API

## 11.1 GET /api/billing/summary

用途：获取套餐、额度和订阅信息。

鉴权：是

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "plan": "pro",
    "subscriptionStatus": "active",
    "currentPeriodEnd": "2026-09-10T00:00:00Z",
    "billingPortalAvailable": true,
    "credits": {
      "total": 120,
      "used": 48,
      "remaining": 72
    }
  }
}
```

## 11.2 POST /api/billing/checkout

用途：创建 Stripe Checkout Session。

鉴权：是

请求体：

```json
{
  "planCode": "pro_monthly"
}
```

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/...",
    "sessionId": "cs_test_123"
  }
}
```

## 11.3 POST /api/billing/portal

用途：创建 Stripe Billing Portal Session。

鉴权：是

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "portalUrl": "https://billing.stripe.com/..."
  }
}
```

## 11.4 POST /api/billing/webhook

用途：Stripe Webhook。

鉴权：否

说明：

- 必须校验 Stripe 签名
- 以 `event.id` 做幂等去重
- 订阅更新按 `provider_subscription_id` 定位并更新
- 不返回业务数据

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "received": true
  }
}
```

## 12. Usage API

## 12.1 GET /api/usage/summary

用途：获取当前额度摘要。

鉴权：是

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "plan": "free",
    "credits": {
      "total": 20,
      "used": 7,
      "remaining": 13
    },
    "metrics": [
      {
        "metricType": "spreadsheet_assistant",
        "usedCount": 3
      }
    ]
  }
}
```

## 12.2 GET /api/usage/history

用途：获取最近使用历史。

鉴权：是

查询参数：

| 参数 | 必填 | 说明 |
|---|---|---|
| days | 否 | 默认 7，最大 90 |

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "items": [
      {
        "id": "ue_01",
        "toolType": "data_analysis",
        "creditDelta": -7,
        "createdAt": "2026-08-10T12:00:00Z"
      }
    ]
  }
}
```

## 13. Dashboard API

## 13.1 GET /api/dashboard/summary

用途：获取首页摘要数据。

鉴权：是

响应：

```json
{
  "success": true,
  "requestId": "req_01",
  "data": {
    "user": {
      "name": "Demo User",
      "plan": "free"
    },
    "credits": {
      "total": 20,
      "used": 7,
      "remaining": 13
    },
    "recentWorkbooks": [],
    "recentJobs": []
  }
}
```

## 14. 典型鉴权与资源校验

每个业务接口至少校验：

1. 用户已登录
2. 资源归属当前用户
3. 用户套餐是否允许该能力
4. 用户额度是否足够
5. 资源状态是否允许执行

## 15. 首批开发优先级

### P0

- `GET /api/auth/me`
- `POST /api/files/upload`
- `GET /api/files/:id/preview`
- `GET /api/assistant/threads`
- `POST /api/assistant/threads`
- `POST /api/assistant/threads/:id/messages`
- `POST /api/pivot-builder`
- `POST /api/data-analysis`
- `POST /api/charts`
- `POST /api/reports`
- `GET /api/billing/summary`
- `GET /api/usage/summary`
- `GET /api/dashboard/summary`

### P1

- `GET /api/pivot-builder/:id`
- `GET /api/data-analysis/:id`
- `GET /api/charts/:id`
- `GET /api/reports/:id`
- `POST /api/reports/:id/export`
- `GET /api/usage/history`
