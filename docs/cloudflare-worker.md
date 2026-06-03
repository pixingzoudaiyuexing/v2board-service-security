# Cloudflare Worker 手动部署教程

本文档介绍如何**直接在 Cloudflare 官网后台**手动创建并部署 `v2board-service-security` 的 Worker 版本。

> 适用场景：
>
> - 需要一个轻量级的备用中间件入口
> - 需要给网页端提供加密请求兜底入口
> - 不想使用本地命令行、`wrangler`、Node.js 这些工具

## 1. Worker 版本说明

从 `1.1.3` 开始，Worker 版本可以继续作为网页端加密请求的备用入口使用。

推荐配置：

- `ENCRYPTED_REQUEST_ONLY=true`

这样 Worker 只接受网页端加密请求，更适合作为网页端的备用入口。

## 2. 准备内容

你需要准备以下信息：

1. 真实后端面板地址
2. 面板类型：
   - `v2b`
   - `xb`
3. 管理后台路径前缀
4. `SEC_PASSWORD`
5. 如果要启用免登或验证码功能，还需要：
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `CAPTCHA_KEY`

同时，请准备好仓库中的 Worker 主文件内容：

```text
cloudflare-worker/worker.js
```

你可以直接打开仓库中的这个文件，复制全部内容。

## 3. 登录 Cloudflare 后台

1. 打开 Cloudflare 官网并登录
2. 左侧找到 **Workers & Pages**
3. 点击 **Create application**
4. 选择 **Create Worker**

## 4. 创建 Worker

1. 给 Worker 起一个名字，例如：

```text
v2board-service-security-fallback
```

2. 点击创建
3. 进入在线编辑器后，删除默认代码
4. 将仓库中 `cloudflare-worker/worker.js` 的内容完整复制进去
5. 点击 **Save and Deploy**

## 5. 在 Cloudflare 后台配置环境变量

创建完成后，进入该 Worker：

1. 点击 **Settings**
2. 找到 **Variables**
3. 在 **Environment Variables** 里添加以下变量

### 普通变量

```text
BACKEND_PANEL=v2b
BACKEND_DOMAIN=https://your-backend.example.com
ADMIN_API_PREFIX=your-admin-prefix
ADMIN_CREATE_USER_ENABLED=false
CAPTCHA_QUICK_ORDER_ENABLED=true
CAPTCHA_REGISTER_ENABLED=true
CAPTCHA_LOGIN_ENABLED=false
ENCRYPTED_REQUEST_ONLY=true
```

说明：

- `BACKEND_DOMAIN`：真实后端面板地址
- `BACKEND_PANEL`：`v2b` 或 `xb`
- `ADMIN_API_PREFIX`：管理后台路径前缀
- `ENCRYPTED_REQUEST_ONLY=true`：纯网页端加密模式推荐值

### Secret 变量

在 **Secrets** 中添加：

```text
SEC_PASSWORD=你的加密密码
ADMIN_EMAIL=你的管理员邮箱
ADMIN_PASSWORD=你的管理员密码
CAPTCHA_KEY=你的验证码密钥
```

说明：

- `SEC_PASSWORD`：网页前端加密时必须和前端一致
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`：免登接口需要
- `CAPTCHA_KEY`：如果启用图形验证码则需要

## 6. 再次部署

变量添加完成后：

1. 回到 Worker 编辑页
2. 点击 **Deploy**

Cloudflare 会自动使用你刚保存的代码和变量重新部署。

## 7. 验证 Worker 是否正常

部署完成后，Worker 会有一个默认地址，例如：

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

说明 Worker 已经运行成功。

## 8. 绑定自定义域名

如果你不想使用 `workers.dev` 默认地址，可以在 Cloudflare 后台手动绑定域名：

1. 进入该 Worker
2. 点击 **Settings**
3. 找到 **Domains & Routes**
4. 点击 **Add Custom Domain**
5. 填入你的备用安全域名，例如：

```text
sec-fallback.example.com
```

6. 保存后等待 Cloudflare 生效

生效后你就可以通过：

```text
https://sec-fallback.example.com/healthz
```

来测试。

## 9. 网页端如何使用

网页端可以把 Worker 作为 `security.endpoints` 的兜底地址：

```js
security: {
  endpoints: [
    "https://anquan.example.com",
    "https://your-worker.your-subdomain.workers.dev",
  ],
}
```

或者如果你绑定了自定义域名：

```js
security: {
  endpoints: [
    "https://anquan.example.com",
    "https://sec-fallback.example.com",
  ],
}
```

## 10. 注意事项

1. Worker 更适合做：
   - 兜底入口
   - 地区性域名阻断时的备用入口
2. 如果你需要完整的网页端加密特征规避，主力入口仍建议优先使用 Node / 二进制版本中间件。
3. 如果 `BACKEND_DOMAIN` 可以走内网或局域网地址，优先使用内网地址，减少真实后端暴露风险。

## 11. 推荐组合

推荐组合是：

- 主入口：服务器上的 Node / 二进制版安全中间件
- 备用入口：Cloudflare Worker
- 网页端：`security.endpoints` 按顺序兜底

这样可以同时兼顾：

- 网页端加密请求
- 地区性域名不可达时的切换能力
