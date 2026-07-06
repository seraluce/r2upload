# R2 Upload

基于 Astro 的 Cloudflare R2 文件上传工具，支持前端直传（Presigned URL）、文件管理、深浅色模式。

## 功能

- 前端直传 R2（通过预签名 URL，不经过 Worker 中转）
- 文件列表自动从 R2 获取
- 管理页面（密码保护）：文件预览、删除、复制 URL
- 深浅色模式切换（自动保存）
- 拖拽上传、进度条、快捷键（Ctrl/Cmd + Enter 上传）
- 响应式设计，适配移动端
- 扁平化线条风格 UI（Lucide 图标）

## 技术栈

- Astro（静态生成）
- Cloudflare Pages Functions（API）
- AWS S3 SDK（R2 兼容）
- Lucide Icons

## 项目结构

```
├── src/pages/
│   ├── index.astro          # 上传页面
│   └── admin.astro          # 管理页面（密码保护）
├── functions/api/
│   ├── upload.js            # 生成预签名上传 URL
│   ├── list.js              # 文件列表 / 删除（公开）
│   └── admin/
│       ├── auth.js          # 登录验证
│       └── files.js         # 文件管理（需认证）
├── astro.config.mjs
├── wrangler.toml
└── package.json
```

## 部署

### Cloudflare Pages

1. Fork 本仓库
2. 在 Cloudflare Pages 创建新项目，连接 GitHub 仓库
3. 构建配置：
   - 构建命令：`pnpm build`
   - 输出目录：`dist`
4. 在 Pages 项目设置中添加环境变量（见下方）

### 环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `CF_ACCOUNT_ID` | Cloudflare 账号 ID | `a1b2c3d4...` |
| `R2_ACCESS_KEY_ID` | R2 Access Key | 可在 R2 > Manage R2 API Tokens 创建 |
| `R2_SECRET_ACCESS_KEY` | R2 Secret Key | |
| `R2_BUCKET_NAME` | R2 存储桶名称 | `arguable` |
| `ADMIN_PASSWORD` | 管理页面密码 | `admin123` |

## 本地开发

```bash
pnpm install
pnpm dev
```

## 使用

- `/` - 上传页面，支持拖拽上传，自动显示 R2 文件列表
- `/admin` - 管理页面，密码登录后可预览、删除、复制文件 URL
