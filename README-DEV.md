# AI Excel 开发调试指南

## 快速启动

### Windows 系统

双击运行 `start-dev.bat` 或在命令行中执行：

```bash
start-dev.bat
```

### macOS / Linux 系统

```bash
chmod +x start-dev.sh
./start-dev.sh
```

### 手动启动

```bash
cd frontend
npm install
npm run dev
```

## 访问地址

启动后访问：**http://localhost:3002**

## 功能页面

- 首页（未登录）: http://localhost:3002/
- Dashboard: http://localhost:3002/dashboard
- Formulas 工具: http://localhost:3002/formulas
- Scripts 工具: http://localhost:3002/scripts
- 登录页: http://localhost:3002/login

## 项目结构

```
frontend/
├── src/
│   ├── app/
│   │   ├── (app)/              # 需要布局的应用页面
│   │   │   ├── dashboard/      # Dashboard 页面
│   │   │   ├── formulas/       # Formulas 工具页
│   │   │   ├── scripts/        # Scripts 工具页
│   │   │   └── layout.tsx      # 应用布局（侧边栏+主内容）
│   │   ├── (auth)/             # 认证相关页面
│   │   │   └── login/          # 登录页
│   │   ├── api/                # API 路由
│   │   │   └── formulas/
│   │   │       └── generate/   # 公式生成 API
│   │   ├── globals.css         # Tailwind CSS 全局样式
│   │   ├── layout.tsx          # 根布局
│   │   └── page.tsx            # 首页（Landing Page）
│   └── components/             # 可复用组件
├── public/                     # 静态资源
├── tailwind.config.js          # Tailwind CSS 配置
├── postcss.config.js           # PostCSS 配置
└── package.json               # 依赖配置
```

## 核心功能实现

### 1. 未登录试用机制

- **首页**: 展示所有工具卡片，点击直接进入工具页
- **试用额度**: 
  - Formulas: 前 4 次免费
  - AI Chat: 前 10 次免费
  - 其他工具: 前 2 次免费
- **额度显示**: 侧边栏底部和工具页内显示剩余次数
- **达到限额**: 自动弹出提示并引导登录

### 2. 界面设计规范

基于设计文档 `businessFunction/aiexcel-ui-design-spec.md` 实现：

- **配色**: 品牌绿色 `#5FD8A0` 主题
- **布局**: 侧边栏（220px）+ 主内容区
- **工具页**: 左右分栏（输入区 / 结果区）
- **响应式**: 移动端自动适配

### 3. API 路由

模拟 API 实现在 `src/app/api/` 目录下：

- `/api/formulas/generate`: POST 请求生成公式

## 开发注意事项

### 端口占用

如果 3002 端口被占用，修改 [`frontend/package.json`](frontend/package.json):

```json
"scripts": {
  "dev": "next dev -p 3003",  // 改为其他端口
}
```

### 停止服务器

- Windows: `Ctrl + C`
- macOS/Linux: `Ctrl + C`

### 清理端口进程

```bash
# Windows
taskkill /F /IM node.exe

# macOS/Linux
pkill -f "node"
```

## 技术栈

- **框架**: Next.js 14 (App Router)
- **样式**: Tailwind CSS
- **语言**: TypeScript
- **包管理**: npm

## 待完成功能

- [ ] SQL 工具页
- [ ] Regex 工具页
- [ ] Template 工具页
- [ ] AI Chat 页面
- [ ] Pivot Builder 页面
- [ ] Data Analysis 页面
- [ ] Reports 页面
- [ ] 用户认证集成
- [ ] 实际 AI API 对接
- [ ] 数据持久化

## 问题排查

### npm install 失败

```bash
# 清理缓存重试
npm cache clean --force
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### 页面样式未生效

检查 Tailwind CSS 配置是否正确加载：

1. 确认 [`tailwind.config.js`](frontend/tailwind.config.js) 存在
2. 确认 [`postcss.config.js`](frontend/postcss.config.js) 存在
3. 重启开发服务器

### API 请求失败

检查 API 路由文件是否存在：[`src/app/api/formulas/generate/route.ts`](frontend/src/app/api/formulas/generate/route.ts)

## 下一步开发

1. 完善其他工具页面（SQL, Regex, Template 等）
2. 实现用户认证流程（JWT/Session）
3. 对接后端 AI API
4. 添加数据持久化（数据库）
5. 实现付费订阅逻辑
6. 移动端优化
7. 性能优化（代码分割、懒加载）

## 联系方式

如有问题，请查看设计文档或提交 Issue。
