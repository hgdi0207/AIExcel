# 多应用 Stripe Webhook 转发服务设计

## 1. 目标与边界

Stripe 只向现有公共入口发送事件：

```text
POST https://avantiai.app/api/v1/webhooks/stripe
```

该入口由 editor-image-ai 服务负责。editor-image-ai 是 Webhook 网关：验证 Stripe 官方签名、识别事件所属应用、持久化投递任务，并把事件可靠转发到目标应用。

AIExcel（对外产品域名 `sheetgpt.io`）的接收地址为：

```text
POST https://sheetgpt.io/api/billing/webhook/forwarded
```

设计原则：

- Stripe Dashboard 只配置 `avantiai.app`，不直接配置各业务应用。
- Stripe `whsec_...` 只保存在 editor-image-ai，不分发给业务应用。
- 每个目标应用使用独立的 HMAC 转发密钥；一个应用泄露不能伪造其他应用事件。
- 投递语义是 at-least-once，各业务应用必须按 Stripe `event.id` 幂等。
- 路由目标只能来自服务端静态配置，绝不能直接使用事件 metadata 中的 URL，避免 SSRF。
- 未识别归属的事件进入 dead-letter/人工处理，禁止广播给所有应用。

## 2. 应用标识与 Checkout 约定

所有创建 Stripe Checkout Session 的应用必须同时写入 Checkout Session 和 Subscription metadata：

```ts
const applicationId = 'sheetgpt';

await stripe.checkout.sessions.create({
  mode: 'subscription',
  metadata: {
    applicationId,
    userId,
    planCode,
  },
  subscription_data: {
    metadata: {
      applicationId,
      userId,
      planCode,
    },
  },
});
```

固定应用标识：

| 应用 | `applicationId` | 转发地址 |
| --- | --- | --- |
| AIExcel / SheetGPT | `sheetgpt` | `https://sheetgpt.io/api/billing/webhook/forwarded` |
| editor-image-ai | `editor-image-ai` | 网关内部直接调用现有处理器，不走公网回环 |

`applicationId` 上线后不可随意改名。`userId` 只在所属应用内部有意义，网关不能用它跨应用查询用户。

## 3. editor-image-ai 路由配置

目标地址必须来自服务端配置表，不能来自 Stripe metadata：

```ts
const routes = {
  sheetgpt: {
    destinationUrl: 'https://sheetgpt.io/api/billing/webhook/forwarded',
    secret: process.env.STRIPE_FORWARD_SHEETGPT_SECRET,
  },
  'editor-image-ai': {
    localHandler: true,
  },
};
```

生成独立密钥：

```bash
openssl rand -hex 32
```

转发密钥至少 32 个字符；推荐直接使用上述命令生成的 64 位十六进制字符串。

同一个值分别配置为：

```text
# editor-image-ai
STRIPE_FORWARD_SHEETGPT_SECRET=<generated-secret>

# AIExcel backend/.env
STRIPE_APPLICATION_ID=sheetgpt
STRIPE_WEBHOOK_FORWARDING_SECRET=<generated-secret>
STRIPE_WEBHOOK_FORWARDING_TOLERANCE_SECONDS=300
```

AIExcel 仍需要 `STRIPE_SECRET_KEY` 创建 Checkout、Billing Portal，并在 Checkout 完成后查询 Subscription。使用中心转发后，AIExcel 的 `STRIPE_WEBHOOK_SECRET` 不参与转发验签，可只在保留 Stripe 直连端点时配置。

## 4. 入站处理流程

editor-image-ai 收到 Stripe 请求后必须按以下顺序处理：

1. 读取原始请求体，使用公共 Endpoint 的 `STRIPE_WEBHOOK_SECRET` 调用 `stripe.webhooks.constructEvent`。
2. 验证成功后，以 `(stripe, event.id)` 为唯一键持久化事件；重复事件不得创建重复投递。
3. 解析 `applicationId`，创建目标应用投递记录并提交到持久化队列。
4. 事件和投递记录成功落库后即可向 Stripe 返回 `2xx`，不要等待远端应用处理完成。
5. Worker 异步执行投递、记录响应码和响应摘要，并按退避策略重试。

推荐的数据模型：

```text
stripe_webhook_events
  event_id              unique
  event_type
  livemode
  application_id
  payload_json
  received_at
  routing_status        routed | unresolved | ignored

stripe_webhook_deliveries
  id
  event_id
  application_id
  destination_url
  status                pending | delivering | delivered | retrying | dead
  attempt_count
  next_attempt_at
  last_http_status
  last_error
  delivered_at
  unique(event_id, application_id)
```

## 5. 应用归属解析

按以下优先级解析，结果必须存在于静态 `routes` 配置：

1. `event.data.object.metadata.applicationId`
2. `event.data.object.subscription_details.metadata.applicationId`（部分 Invoice 事件）
3. 从事件中的 Subscription ID 查询本地 `subscription_id -> application_id` 路由表
4. 必要时调用 Stripe API 获取 Subscription，再读取 `subscription.metadata.applicationId`
5. 仍无法识别时标记 `unresolved`，告警并人工处理

禁止按 `userId`、金额、产品名称或邮箱猜测应用；禁止广播未知事件；禁止使用 metadata 传入的 URL。

网关至少转发 AIExcel 当前处理的事件：

```text
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
```

其他事件可以持久化为 `ignored`，或者在业务应用实现处理逻辑后再加入 allowlist。

## 6. 转发协议

请求体是经过 Stripe SDK 验证后的完整 `Stripe.Event` JSON：

```http
POST /api/billing/webhook/forwarded HTTP/1.1
Host: sheetgpt.io
Content-Type: application/json
X-Webhook-App-Id: sheetgpt
X-Webhook-Timestamp: 1789520000
X-Webhook-Signature: v1=<64-character-lowercase-hex>

{"id":"evt_...","object":"event","type":"checkout.session.completed",...}
```

签名输入严格为以下字节序列：

```text
<timestamp>.<applicationId>.<raw request body bytes>
```

算法是 `HMAC-SHA256(per-application-secret, signing-input)`。Node.js 参考实现：

```ts
const body = Buffer.from(JSON.stringify(stripeEvent), 'utf8');
const timestamp = Math.floor(Date.now() / 1000).toString();
const applicationId = 'sheetgpt';
const signature = createHmac('sha256', route.secret)
  .update(`${timestamp}.${applicationId}.`, 'utf8')
  .update(body)
  .digest('hex');

await fetch(route.destinationUrl, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-webhook-app-id': applicationId,
    'x-webhook-timestamp': timestamp,
    'x-webhook-signature': `v1=${signature}`,
  },
  body,
  redirect: 'error',
  signal: AbortSignal.timeout(10_000),
});
```

必须对最终实际发送的 `body` 字节签名。签名后不能重新格式化 JSON。

## 7. 返回码、重试与幂等

| 响应 | 网关行为 |
| --- | --- |
| 任意 `2xx` | 标记 `delivered`；duplicate 也视为成功 |
| `400` | 事件结构错误，标记 dead 并告警 |
| `401` / `403` | 密钥、时间或路由配置错误，标记 dead 并立即告警 |
| `404` | 部署或 URL 配置错误，少量重试后 dead |
| `408` / `425` / `429` / `5xx` / 网络错误 | 指数退避重试 |

建议重试间隔：`1m, 5m, 30m, 2h, 6h, 12h`，总窗口至少 24 小时，并加入 10%~20% jitter。管理端需要支持按 `event.id` 手工重放 dead delivery。

AIExcel 使用数据库唯一键 `(provider, providerEventId)`，即 `(stripe, event.id)` 去重。处理失败的事件再次送达时会重新处理；已成功事件返回 duplicate，不重复发放权益。

## 8. 安全要求

- 网关与目标应用全程使用 HTTPS；Cloudflare 使用 Full (strict)。
- 每个应用单独密钥，密钥不得写入 Git、日志或接口响应。
- 接收端使用常量时间比较验证签名。
- 接收端允许时间偏差默认 300 秒，防止截获请求长期重放。
- 即使签名有效，AIExcel 仍检查事件 metadata 的 `applicationId` 必须为 `sheetgpt`。
- 限制请求体大小为 1 MB，设置 10 秒连接/响应超时。
- 日志记录 `event.id`、类型、applicationId、attempt 和 HTTP 状态，禁止记录密钥和完整支付信息。
- 出站 URL 来自静态配置并限制为 HTTPS，不跟随重定向到未知主机。

## 9. 历史订阅迁移

新代码上线前创建的 Subscription 可能没有 `metadata.applicationId`。这些订阅的后续事件会无法路由，切换公共 Webhook 前必须完成以下任一方案：

1. 根据各应用数据库中的 `providerSubscriptionId` 调用 Stripe API，补上对应的 `applicationId`。
2. 在网关数据库导入完整的 `subscription_id -> application_id` 映射。

补 metadata 时保留原有值：

```ts
const subscription = await stripe.subscriptions.retrieve(subscriptionId);
await stripe.subscriptions.update(subscriptionId, {
  metadata: {
    ...subscription.metadata,
    applicationId: 'sheetgpt',
  },
});
```

不要用 Stripe 客户邮箱作为长期路由键。

## 10. 上线顺序与验收

1. 部署 AIExcel 新后端，配置 `STRIPE_APPLICATION_ID` 和 `STRIPE_WEBHOOK_FORWARDING_SECRET`。
2. 验证接收端无签名时返回 401。
3. 在 editor-image-ai 配置同一份 SheetGPT 转发密钥和静态 URL。
4. 完成历史 Subscription metadata 或路由映射迁移。
5. 使用 Stripe 测试模式验证路由、签名、失败重试和 duplicate 响应。
6. 在 AIExcel 发起测试 Checkout，确认 Session 与 Subscription 都包含 `applicationId=sheetgpt`。
7. 确认 AIExcel 的 `billing_webhook_events` 保存相同 `evt_...`，订阅和用户计划更新正确。
8. 确认 editor-image-ai 自身订单仍进入本地处理器，不发往 SheetGPT。
9. 测试模式通过后切换 live mode；测试与生产密钥、队列和数据必须隔离。

验收用例至少包括：合法投递、篡改 body、篡改 applicationId、过期时间戳、重复 event.id、目标超时、目标 500 后恢复、未知应用、历史订阅路由、Stripe 重复投递。
