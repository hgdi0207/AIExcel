# Java Pivot Export Service 本地安装与联调步骤

版本：v1.0  
日期：2026-08-16  
适用范围：Windows 本地开发环境下，为 `java-pivot-export-service` 安装 JDK / Maven，并完成与 NestJS / Frontend 的联调

关联文档：
- `businessFunction/java-pivot-export-service-spec.md`
- `businessFunction/native-pivot-export-decision.md`
- `businessFunction/pivot-jobs-migration-plan.md`

---

## 1. 文档目标

本文档解决 4 件事：

1. 本机安装 JDK 21
2. 本机安装 Maven 3.9+
3. 启动 Java Pivot 导出服务
4. 打通 `Frontend -> NestJS -> Java Pivot Export Service -> 下载 xlsx` 的本地联调链路

---

## 2. 当前项目口径

当前仓库中的 Java 导出服务目录：

```text
java-pivot-export-service/
```

当前约定：

- Java 服务端口：`8085`
- NestJS 服务端口：`3000`
- Frontend 服务端口：`3001`
- Java 服务只对 NestJS 开放，不直接给浏览器调用
- 浏览器最终下载仍然走：

```text
GET /api/pivot-builder/:id/download
```

---

## 3. 本机安装 JDK 21

## 3.1 推荐版本

建议安装：

- `JDK 21`

原因：

- 当前 Java 服务 `pom.xml` 已指定 `java.version=21`
- Spring Boot 3 与 JDK 21 兼容良好

## 3.2 推荐来源

可使用任一正式 JDK 21 发行版，建议优先：

- Eclipse Temurin 21

官方入口：

- https://adoptium.net/

## 3.3 Windows 安装步骤

### 方案 A：图形安装

1. 打开 Temurin 官方网站
2. 下载 Windows x64 的 JDK 21 安装包
3. 双击安装
4. 记住安装目录，例如：

```text
C:\Program Files\Eclipse Adoptium\jdk-21
```

### 方案 B：如果公司电脑允许使用包管理器

可以用 `winget`，例如：

```powershell
winget install EclipseAdoptium.Temurin.21.JDK
```

如果你们公司机器禁用了 `winget`，就走方案 A。

## 3.4 配置 JAVA_HOME 与 PATH

打开 Windows“系统环境变量”界面，新增：

```text
变量名：JAVA_HOME
变量值：C:\Program Files\Eclipse Adoptium\jdk-21
```

然后编辑 `Path`，新增：

```text
%JAVA_HOME%\bin
```

## 3.5 验证 JDK 安装

新开一个 PowerShell，执行：

```powershell
java -version
javac -version
```

预期：

- 能输出 Java 21 版本号
- `java` 和 `javac` 都可识别

---

## 4. 本机安装 Maven 3.9+

## 4.1 推荐版本

建议安装：

- `Apache Maven 3.9.x`

原因：

- 官方安装文档说明 Maven 3.9.x 可直接使用
- 当前项目 `pom.xml` 与 Spring Boot Maven Plugin 兼容

## 4.2 官方说明

Maven 官方安装页：

- https://maven.apache.org/install

Windows 前置说明页：

- https://maven.apache.org/guides/getting-started/windows-prerequisites.html

注意：

- Maven 本身没有必须的“图形安装器”
- Windows 下常见做法是下载压缩包后解压，再把 `bin` 加入 `Path`

## 4.3 Windows 安装步骤

1. 打开 Maven 官方安装页
2. 下载 `Binary zip archive`
3. 解压到固定目录，例如：

```text
C:\dev\apache-maven-3.9.16
```

4. 新增系统环境变量：

```text
变量名：MAVEN_HOME
变量值：C:\dev\apache-maven-3.9.16
```

5. 编辑 `Path`，新增：

```text
%MAVEN_HOME%\bin
```

## 4.4 验证 Maven 安装

新开一个 PowerShell，执行：

```powershell
mvn -version
```

预期输出中至少要看到：

- `Apache Maven 3.9.x`
- `Java version: 21`

如果 `mvn -version` 里显示的 Java 版本不是 21，说明 `JAVA_HOME` 或 `Path` 还没生效。

---

## 5. 首次运行前的本地准备

## 5.1 确认数据库已可用

后端依赖 PostgreSQL。你之前已经把数据库放在：

```text
192.168.188.131:5431
```

先确认数据库可连接。

## 5.2 安装 Node 依赖

如果仓库根目录还没装过依赖：

```powershell
npm.cmd install
```

如果之前已经装过，可以跳过。

## 5.3 Java 服务的 Maven 首次下载说明

第一次执行：

```powershell
mvn clean package
```

或：

```powershell
mvn spring-boot:run
```

Maven 会联网下载依赖，第一次可能较慢。

如果公司网络有限制，常见问题有：

- 下载超时
- 防火墙拦截 `java.exe`
- 代理未配置

如果遇到依赖下载失败，需要先让 Maven 能访问公网仓库。

---

## 6. Java 服务本地配置

## 6.1 当前代码读取方式说明

当前 Java 服务使用 Spring Boot 标准环境变量，不会自动读取 `.env` 文件。

也就是说：

- `java-pivot-export-service/.env.example` 是配置模板
- 真正启动时，变量需要通过系统环境变量、IDE Run Configuration，或 PowerShell 当前会话注入

## 6.2 建议本地取值

Java 服务建议使用以下变量：

```text
PORT=8085
PIVOT_EXPORT_SHARED_TOKEN=change-me
PIVOT_EXPORT_STORAGE_ROOT=E:\huanggengdi\overseaNetPage\buinessPage\AIExcel\backend\storage\exports\pivot
PIVOT_EXPORT_ALLOWED_SOURCE_ROOTS=E:\huanggengdi\overseaNetPage\buinessPage\AIExcel\backend\storage\local\uploads
```

说明：

- `PIVOT_EXPORT_STORAGE_ROOT` 必须和 NestJS 侧下载路径约定一致
- `PIVOT_EXPORT_ALLOWED_SOURCE_ROOTS` 用于限制 Java 只读取上传目录，避免任意文件读取

## 6.3 PowerShell 临时注入方式

建议在启动 Java 服务前，在当前 PowerShell 执行：

```powershell
$env:PORT="8085"
$env:PIVOT_EXPORT_SHARED_TOKEN="change-me"
$env:PIVOT_EXPORT_STORAGE_ROOT="E:\huanggengdi\overseaNetPage\buinessPage\AIExcel\backend\storage\exports\pivot"
$env:PIVOT_EXPORT_ALLOWED_SOURCE_ROOTS="E:\huanggengdi\overseaNetPage\buinessPage\AIExcel\backend\storage\local\uploads"
```

这只对当前窗口生效，适合本地联调。

---

## 7. NestJS 侧联调配置

要让后端真正调用 Java 服务，需要把 `backend/.env` 至少调整为：

```env
PIVOT_EXPORT_MODE=java_native
PIVOT_EXPORT_SERVICE_URL=http://127.0.0.1:8085
PIVOT_EXPORT_SHARED_TOKEN=change-me
PIVOT_EXPORT_TIMEOUT_MS=30000
PIVOT_EXPORT_STORAGE_ROOT=E:\huanggengdi\overseaNetPage\buinessPage\AIExcel\backend\storage\exports\pivot
PIVOT_EXPORT_ALLOWED_SOURCE_ROOTS=E:\huanggengdi\overseaNetPage\buinessPage\AIExcel\backend\storage\uploads
```

建议同时确认下面这些值：

```env
FRONTEND_ORIGIN=http://127.0.0.1:3001
CORS_ORIGINS=http://127.0.0.1:3001
DATABASE_URL=postgresql://postgres:postgres@192.168.188.131:5431/aiexcel
```

说明：

- `PIVOT_EXPORT_SHARED_TOKEN` 必须与 Java 服务一致
- `PIVOT_EXPORT_SERVICE_URL` 必须指向 Java 服务实际端口
- `PIVOT_EXPORT_MODE` 不改成 `java_native`，后端仍然会走 Node fallback

---

## 8. 启动步骤

建议开 3 个 PowerShell 窗口，分别启动 Java / Backend / Frontend。

## 8.1 窗口一：启动 Java Pivot 服务

先注入环境变量：

```powershell
$env:PORT="8085"
$env:PIVOT_EXPORT_SHARED_TOKEN="change-me"
$env:PIVOT_EXPORT_STORAGE_ROOT="E:\huanggengdi\overseaNetPage\buinessPage\AIExcel\backend\storage\exports\pivot"
$env:PIVOT_EXPORT_ALLOWED_SOURCE_ROOTS="E:\huanggengdi\overseaNetPage\buinessPage\AIExcel\backend\storage\uploads"
```

然后启动：

```powershell
npm.cmd run dev:pivot-java
```

或直接：

```powershell
cd E:\huanggengdi\overseaNetPage\buinessPage\AIExcel\java-pivot-export-service
mvn spring-boot:run
```

## 8.2 窗口二：启动 NestJS Backend

在项目根目录执行：

```powershell
npm.cmd run dev:backend
```

## 8.3 窗口三：启动 Frontend

在项目根目录执行：

```powershell
npm.cmd run dev:frontend
```

---

## 9. 健康检查

## 9.1 Java 服务健康检查

浏览器或命令行访问：

```text
http://127.0.0.1:8085/internal/health
```

预期：

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

## 9.2 NestJS 健康检查

访问：

```text
http://127.0.0.1:3000/api/health
```

## 9.3 Frontend 页面检查

访问：

```text
http://127.0.0.1:3001/login
```

---

## 10. Java 服务单独联调

在跑完整前后端联调前，建议先直接调用 Java 服务一次。

## 10.1 准备一个已上传文件

先通过前端或接口上传一个 `csv / xlsx`，确保后端已经把文件落到：

```text
backend\storage\local\uploads\...
```

## 10.2 用 curl.exe 直接调用

注意：

- 在 PowerShell 里不要写 `curl`
- 请写 `curl.exe`

示例：

```powershell
curl.exe -i http://127.0.0.1:8085/internal/pivot/export ^
  -H "Content-Type: application/json" ^
  -H "X-Internal-Token: change-me" ^
  -H "X-Request-Id: local-test-001" ^
  -d "{\"jobId\":\"local-test-001\",\"userId\":\"debug-user\",\"sourceFilePath\":\"E:\\\\huanggengdi\\\\overseaNetPage\\\\buinessPage\\\\AIExcel\\\\backend\\\\storage\\\\local\\\\uploads\\\\YOUR_FILE.xlsx\",\"sourceFileName\":\"YOUR_FILE.xlsx\",\"sourceSheetName\":\"Sheet1\",\"outputFileName\":\"local-test-pivot.xlsx\",\"pivotConfig\":{\"rows\":[\"Region\"],\"columns\":[\"Month\"],\"values\":[{\"field\":\"Revenue\",\"aggregation\":\"sum\"}],\"filters\":[]}}"
```

如果你更习惯 PowerShell 原生写法，也可以用：

```powershell
$body = @{
  jobId = "local-test-001"
  userId = "debug-user"
  sourceFilePath = "E:\huanggengdi\overseaNetPage\buinessPage\AIExcel\backend\storage\local\uploads\YOUR_FILE.xlsx"
  sourceFileName = "YOUR_FILE.xlsx"
  sourceSheetName = "Sheet1"
  outputFileName = "local-test-pivot.xlsx"
  pivotConfig = @{
    rows = @("Region")
    columns = @("Month")
    values = @(
      @{
        field = "Revenue"
        aggregation = "sum"
      }
    )
    filters = @()
  }
} | ConvertTo-Json -Depth 6

Invoke-RestMethod `
  -Uri "http://127.0.0.1:8085/internal/pivot/export" `
  -Method Post `
  -Headers @{
    "X-Internal-Token" = "change-me"
    "X-Request-Id" = "local-test-001"
  } `
  -ContentType "application/json" `
  -Body $body
```

预期：

- 返回 `success: true`
- `data.exportFilePath` 指向导出的 `.xlsx`
- 用压缩软件打开该文件，内部应能看到：
  - `xl/pivotTables/...`
  - `xl/pivotCache/...`

---

## 11. 全链路联调步骤

## 11.1 切到 Java Native 模式

确认 `backend/.env` 中已经是：

```env
PIVOT_EXPORT_MODE=java_native
```

## 11.2 启动三端

按第 8 节顺序启动：

1. Java 服务
2. Backend
3. Frontend

## 11.3 浏览器联调

1. 打开 `http://127.0.0.1:3001/login`
2. 完成 Google 登录
3. 上传一个可用于透视的表格
4. 打开 `/pivot-builder`
5. 输入：

```text
Build a pivot grouped by Region and Month with Revenue as sum.
```

6. 提交任务
7. 等待任务完成
8. 点击下载

预期：

- 后端任务状态变成 `completed`
- 前端出现 `Download xlsx`
- 下载到的文件能被 Excel 正常打开
- 文件里是原生透视表，而不是普通汇总 sheet

---

## 12. 常见问题排查

## 12.1 `java` 或 `mvn` 找不到

现象：

```text
java : 无法将“java”项识别为...
mvn : 无法将“mvn”项识别为...
```

原因：

- 没装 JDK 或 Maven
- `JAVA_HOME` / `MAVEN_HOME` / `Path` 未生效

处理：

1. 重新检查环境变量
2. 关闭当前 PowerShell，重新打开
3. 再执行：

```powershell
java -version
mvn -version
```

## 12.2 Maven 依赖下载失败

现象：

- 首次 `mvn spring-boot:run` 卡住
- 依赖下载 timeout

原因：

- 网络限制
- 防火墙拦截
- 公司代理未配置

处理：

1. 先确认浏览器能访问 Maven Central
2. 如公司要求代理，单独配置 Maven `settings.xml`
3. 确认 `java.exe` 未被防火墙拦截

## 12.3 Java 服务健康检查不通

排查顺序：

1. 看启动窗口是否报错
2. 看端口 `8085` 是否被占用
3. 确认当前窗口里已注入 `PIVOT_EXPORT_SHARED_TOKEN`
4. 再访问：

```text
http://127.0.0.1:8085/internal/health
```

## 12.4 Backend 仍然走 Node fallback

现象：

- 前端可以下载文件
- 但结果还是旧逻辑，不像 Java native

优先检查：

1. `backend/.env` 中是否为：

```env
PIVOT_EXPORT_MODE=java_native
```

2. Backend 是否重启过
3. Java 服务是否真的启动成功
4. `PIVOT_EXPORT_SERVICE_URL` 是否正确

## 12.5 Java 返回 401

原因：

- `PIVOT_EXPORT_SHARED_TOKEN` 前后不一致

处理：

确认：

- Java 服务环境变量里的 `PIVOT_EXPORT_SHARED_TOKEN`
- `backend/.env` 里的 `PIVOT_EXPORT_SHARED_TOKEN`

两边完全一致。

## 12.6 导出的文件不是原生 Pivot

排查：

1. 用压缩软件打开导出的 `.xlsx`
2. 检查是否存在：
   - `xl/pivotTables/`
   - `xl/pivotCache/`
3. 如果没有，说明 Java 侧实际导出逻辑未生效，或运行的不是最新代码

---

## 13. 最小验收清单

满足以下 8 项，就可以认为本地 Java 联调基本通过：

1. `java -version` 输出 JDK 21
2. `mvn -version` 输出 Maven 3.9+ 且 Java 版本为 21
3. `GET http://127.0.0.1:8085/internal/health` 返回成功
4. `GET http://127.0.0.1:3000/api/health` 返回成功
5. Google 登录成功
6. Pivot Builder 任务执行完成
7. 可以下载 `-pivot.xlsx`
8. 压缩查看导出文件时，存在 `pivotTables` 与 `pivotCache`

---

## 14. 官方参考

以下内容基于官方文档整理：

- Maven 安装说明：<https://maven.apache.org/install>
- Maven Windows 前置说明：<https://maven.apache.org/guides/getting-started/windows-prerequisites.html>
- Spring Boot Maven Plugin `spring-boot:run`：<https://docs.spring.io/spring-boot/maven-plugin/>
- Spring Boot 运行应用说明：<https://docs.spring.io/spring-boot/3.5/reference/using/running-your-application.html>
- Eclipse Temurin 下载入口：<https://adoptium.net/>
