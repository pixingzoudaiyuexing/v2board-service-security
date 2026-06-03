# Cloudflare Worker 快速部署使用

本文档介绍如何使用 Cloudflare Worker 部署 `v2board-service-security` 的 Worker 版本。

> 适用场景：
>
> - 需要一个轻量级的备用中间件入口
> - 需要给网页端提供加密请求兜底入口

## 1. Worker 版本说明

从 `1.1.3` 开始，Worker 版本可以继续作为网页端加密请求的备用入口使用。

## 2. 准备文件

Worker 相关文件位于：

```text
cloudflare-worker/
├── worker.js
├── wrangler.toml
└── README.md
```

其中：

- `worker.js` 是 Worker 主程序
- `wrangler.toml` 是部署配置

## 3. 安装 Wrangler

请先确保本地有 Node.js 环境，然后安装 Wrangler：

```bash
npm install -g wrangler
```

登录 Cloudflare：

```bash
wrangler login
```

## 4. 配置 wrangler.toml

打开：

```text
cloudflare-worker/wrangler.toml
```

按你的实际情况修改变量：

```toml
name = "v2board-service-security-fallback"
main = "worker.js"
compatibility_date = "2026-06-02"

[vars]
BACKEND_PANEL = "v2b"
BACKEND_DOMAIN = "https://your-backend.example.com"
ADMIN_API_PREFIX = "your-admin-prefix"
ADMIN_CREATE_USER_ENABLED = "false"
CAPTCHA_QUICK_ORDER_ENABLED = "true"
CAPTCHA_REGISTER_ENABLED = "true"
CAPTCHA_LOGIN_ENABLED = "false"
ENCRYPTED_REQUEST_ONLY = "true"
```

说明：

- `BACKEND_DOMAIN`：真实后端面板地址
- `BACKEND_PANEL`：`v2b` 或 `xb`
- `ADMIN_API_PREFIX`：管理后台路径前缀
- `ENCRYPTED_REQUEST_ONLY=true`：只接受网页端加密请求的推荐配置

## 5. 设置 Secrets

以下变量建议作为 Worker Secret 写入：

```bash
cd cloudflare-worker

wrangler secret put SEC_PASSWORD
wrangler secret put ADMIN_EMAIL
wrangler secret put ADMIN_PASSWORD
wrangler secret put CAPTCHA_KEY
```

说明：

- `SEC_PASSWORD`：网页前端加密时必须与前端一致
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`：免登接口需要
- `CAPTCHA_KEY`：如果启用图形验证码则需要

## 6. 部署 Worker

进入项目根目录，执行：

```bash
npm install
npx wrangler deploy --config cloudflare-worker/wrangler.toml
```

或者使用项目脚本：

```bash
npm install
npm run deploy:worker
```

如果你使用 Bun，也可以先安装依赖后直接执行：

```bash
bun install
npx wrangler deploy --config cloudflare-worker/wrangler.toml
```

## 7. 验证 Worker

部署完成后，你会拿到一个 Worker 域名，例如：

```text
https://your-worker.your-subdomain.workers.dev
```

先访问健康检查：

```text
https://your-worker.your-subdomain.workers.dev/healthz
```

如果返回：

```text
ok
```

说明 Worker 已经运行。

## 8. 使用方式

### 网页端

网页端可以继续把 Worker 作为 `security.endpoints` 的兜底地址：

```js
security: {
  endpoints: [
    "https://anquan.example.com",
    "https://your-worker.your-subdomain.workers.dev",
  ],
}
```

## 9. 注意事项

1. Worker 更适合做：
   - 兜底入口
   - 地区性域名阻断时的备用入口
2. 如果你需要完整的网页端加密特征规避，主力入口仍建议优先使用 Node / 二进制版本中间件。
3. 如果 `BACKEND_DOMAIN` 可以走内网或局域网地址，优先使用内网地址，减少真实后端暴露风险。

## 10. 推荐组合

推荐组合是：

- 主入口：服务器上的 Node / 二进制版安全中间件
- 备用入口：Cloudflare Worker
- 网页端：`security.endpoints` 按顺序兜底

这样可以同时兼顾：

- 网页端加密请求
- 地区性域名不可达时的切换能力
