# Cloudflare Worker 快速部署使用

本文档介绍如何使用 Cloudflare Worker 部署 `v2board-service-security` 的 Worker 版本。

> 适用场景：
>
> - 需要一个轻量级的备用中间件入口
> - 需要给网页端提供加密请求兜底入口
> - 需要给安卓 App 提供普通 HTTPS 代理入口
> - 需要将多个 Worker 域名作为安卓 App 启动时择优候选域名

## 1. Worker 版本说明

从 `1.1.3` 开始，Worker 版本支持兼容模式：

- 网页端：继续支持现有加密请求、加密响应模式
- 安卓 App：支持普通 HTTPS 请求先访问 Worker，再由 Worker 转发到真实后端

如果你需要同时兼容网页端和安卓 App，请将：

```dotenv
ENCRYPTED_REQUEST_ONLY=false
```

设置为 `false`。

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
ENCRYPTED_REQUEST_ONLY = "false"
```

说明：

- `BACKEND_DOMAIN`：真实后端面板地址
- `BACKEND_PANEL`：`v2b` 或 `xb`
- `ADMIN_API_PREFIX`：管理后台路径前缀
- `ENCRYPTED_REQUEST_ONLY=false`：兼容网页端和安卓 App 的关键配置

> 如果你的 Worker 只作为网页端加密兜底入口，并且不接安卓 App，也可以设回 `true`。

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

### 安卓 App

如果安卓 App 需要走 Worker，可将 Worker 域名放入 OSS 配置文件候选列表中，例如：

```text
https://anquan-a.example.com|https://anquan-b.example.com|https://your-worker.your-subdomain.workers.dev
```

然后再进行 Base64 编码，写入 `android_config_1.2.4.txt`。

## 9. 注意事项

1. Worker 版本支持普通 HTTPS 代理，但安卓 App 目前不具备网页端同等级的请求加密混淆能力。
2. Worker 更适合做：
   - 兜底入口
   - 地区性域名阻断时的候选入口
   - 低成本多域名入口补充
3. 如果你需要完整的网页端加密特征规避，主力入口仍建议优先使用 Node / 二进制版本中间件。
4. 如果 `BACKEND_DOMAIN` 可以走内网或局域网地址，优先使用内网地址，减少真实后端暴露风险。

## 10. 推荐组合

推荐组合是：

- 主入口：服务器上的 Node / 二进制版安全中间件
- 备用入口：Cloudflare Worker
- 安卓 App：启动时多候选域名择优
- 网页端：`security.endpoints` 按顺序兜底

这样可以同时兼顾：

- 网页端加密请求
- 安卓 App 普通代理
- 地区性域名不可达时的切换能力
