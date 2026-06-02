
</div>

---


### 1. 加密转发

可以对接口的请求和响应进行加密处理，就像给你的数据穿上了一层保护衣，防止被墙，让数据传输更加安全。

![](https://github.com/dc8683/picx-images-hosting/raw/master/docs/Clipboard---2025-06-17-15.06.21.6t7dmwj0sn.webp)

### 1.1 兼容模式

`1.1.3` 开始，安全中间件支持两种模式共存：

- 网页前端继续使用原有的加密请求和加密响应
- 安卓 App 可以直接使用普通 HTTPS 请求先访问安全中间件，再由中间件转发到真实后端

如果你需要同时兼容网页端和安卓 App，请将：

```dotenv
ENCRYPTED_REQUEST_ONLY=false
```

这样可以同时接受加密请求和明文请求。

### 2. 免登接口

- 免登获取商品列表：可以在用户不登录的情况下获取商品列表，方便用户浏览和选择商品
- 免登获取付款方式：可以在用户不登录的情况下获取付款方信息，方便用户进行支付
- 免登创建订单接口：可以在用户不登录的情况下创建订单并实现自动注册登录账号，简化了用户的操作流程

> Tips: 免登接口的使用需要在 v2board/xboard/xiaoboard 后台管理面板中将邮箱注册验证关闭，因为免登自动注册账号时程序调用的常规注册接口，同时，我们考虑到恶意攻击和刷注册账号的情况，提供了图形验证码的支持，您可以在环境变量中配置是否启用图形验证码。以下是免登逻辑和 Rocket 的免等页面

![](https://github.com/dc8683/picx-images-hosting/raw/master/docs/Clipboard---2025-06-26-00.55.27.8hgqvukgod.webp)

![](https://github.com/dc8683/picx-images-hosting/raw/master/docs/免登注册一体页面.7w735ov4x2.webp)

### 3. 自建 SMTP

可以自建 SMTP 服务器，支持自定义邮件模板，方便用户发送邮件通知和营销邮件

![](https://github.com/dc8683/picx-images-hosting/raw/master/docs/Clipboard---2025-06-23-08.10.25.7axfje3ikg.webp)

### 4. 环境变量

在`.env.example`文件中包含了主要的环境变量配置，您可以根据需要进行修改。以下是一些主要的环境变量：

#### 必备环境变量

- PORT: 服务监听端口，默认值为 3000
- BACKEND_DOMAIN: 你的后端域名，示例: https://api.xxx.com ，如果此服务和面板在同一台服务器上，可以使用局域网地址（局域网通信速度最佳，且可以关闭 v2board/xboard 面板对外的暴露），示例: http://127.0.0.1:3000
- SEC_PASSWORD: AES 加密密码，用于加解密，请和前端中的 security.password 保持一致

#### 免登接口的管理面板配置

- ADMIN_API_PREFIX: 面板管理后端 API 前缀，即管理面板的后台路径
- ADMIN_TOKEN: 面板管理员令牌，用于身份验证和权限控制，如果你填了 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 则不需要填入 `ADMIN_TOKEN`，因为每次启动服务都会自动生成一个新的 `ADMIN_TOKEN`
- ADMIN_EMAIL: 面板管理员邮箱账号
- ADMIN_PASSWORD: 面板管理员密码
- ADMIN_CREATE_USER_ENABLED: 是否允许管理员通过面板创建用户，true 表示允许，false 表示禁止，此环境变量主要解决开启邮箱注册验证，如果开启了邮箱注册验证，必须将此环境变量设置为 true，当使用了管理员创建用户能力后，邀请码将失效

#### 邮件服务配置

- MAIL_HOST: SMTP 邮件服务器地址
- MAIL_PORT: SMTP 邮件服务器端口
- MAIL_SECURE: SMTP 邮件服务器安全协议，true 或 false
- MAIL_USER: SMTP 邮件服务器用户名
- MAIL_PASS: SMTP 邮件服务器密码
- MAIL_NEWUSER_SUBJECT: 新用户注册邮件主题
- MAIL_NEWUSER_URL: 新用户注册邮件模板链接，用于向新用户发送注册成功和账号密码的通知，需自行创建一个邮件模板文件，并将其放置在 cdn 上，作为链接，设置到 `MAIL_NEWUSER_URL` 环境变量中，如果不设置，将默认采用纯文本模板

#### 图形验证码配置

- CAPTCHA_KEY: 验证码密钥，用于防止恶意提交免登订单攻击
- CAPTCHA_QUICK_ORDER_ENABLED: 是否启用免登创建支付订单验证码，true 或 false
- CAPTCHA_REGISTER_ENABLED: 是否启用注册验证码，true 或 false
- CAPTCHA_LOGIN_ENABLED: 是否启用登录验证码，true 或 false

#### 安全设置

- ENCRYPTED_REQUEST_ONLY: 是否只允许加密请求，true 表示只接受加密请求，false 表示同时接受明文和加密请求

示例配置:

```dotenv
# 必备环境变量
PORT=3000 # 面板运行端口，docker 部署时请确保容器端口映射正确，其它部署方式请确保端口未被占用
BACKEND_PANEL=v2b # 面板类型，v2b 表示 v2board/xiaoboard 面板，xb 表示 xboard 面板
BACKEND_DOMAIN=https://api.xxx.com # 面板后端 API 域名
SEC_PASSWORD=89236475 # AES 加密密码，用于加解密，请和前端中的 security.password 保持一致

# 用于实现免登接口的管理面板配置
ADMIN_API_PREFIX=c523003d # 面板的后台管理路径
ADMIN_EMAIL=admin@qq.com # 面板管理员邮箱
ADMIN_PASSWORD=xxxxxx # 面板管理员密码
ADMIN_CREATE_USER_ENABLED=false # 是否允许管理员通过面板创建用户，true 表示允许，false 表示禁止

# 邮件服务配置
MAIL_HOST=smtp.gmail.com # 邮件服务器地址
MAIL_PORT=465 # 邮件服务器端口
MAIL_SECURE=true # 是否使用安全连接
MAIL_USER=airbuddy@gmail.com # 邮件发送者地址
MAIL_PASS=xxxxxxxxxxxxxxxxxx # 邮件发送者密码
MAIL_NEWUSER_SUBJECT='欢迎加入 AirBuddy' # 新用户注册邮件主题
MAIL_NEWUSER_URL= https://xxx.com/NewUser.html # 新用户注册邮件模板 URL

# 验证码配置
CAPTCHA_KEY=1234 # 验证码密钥，用于生成和验证图形验证码
CAPTCHA_QUICK_ORDER_ENABLED=true # 是否启用免登创建支付订单图形验证码
CAPTCHA_REGISTER_ENABLED=true # 是否启用注册图形验证码
CAPTCHA_LOGIN_ENABLED=true # 是否启用登录图形验证码

# 安全设置
ENCRYPTED_REQUEST_ONLY=false # 是否只允许加密请求，true 表示只接受加密请求，false 表示同时接受明文和加密请求
```

> tips: 如果你只是需要防墙通信，而不需要免登支付注册一体的话，就只需要配置 `BACKEND_DOMAIN`、 `SEC_PASSWORD`、`PORT` 即可，其他配置可以不填

### 5. 邮件模板

我们提供了一个默认的邮件模板，你可以在 [NewUser Email Template](https://github.com/dc8683/picx-images-hosting/blob/master/email-template/NewUser.html) 下载下来修改网址和内容，或者自行创建一个新的邮件模板文件，并将其放置在 cdn 上，作为链接，设置到 `MAIL_NEWUSER_URL` 环境变量中，如果不设置，将默认采用纯文本模板。

此外，如果你需要定制更好看的邮件模板，我们非常推荐使用 [wand email](https://www.wand.email/)，这是一个非常好用的 AI 一键生成邮件模板工具

## 快速部署

### [docker-compose 快速部署](/docs/docker-compose.md)

可视化操作，每一步都能看到，适合新手用户

### [docker-xboard 快速部署](/docs/docker-xboard.md)

适合 xboard 用户，需要在 xboard 的 `compose.yml` 中添加 security 服务，支持局域网和面板通信，提高通信速度，适合有一定经验的用户

### [docker 一键命令部署](/docs/docker.md)

终端命令行一键部署操作，适合有经验的用户，此脚本由 [Tethyiah](http://t.me/Tethyiah) 提供，感谢他的贡献

### [node.js 快速部署](/docs/node.md)

最轻量的部署方式，只需运行一个不到 2mb 的 js 文件，即可完成部署，使用守护进程，可视化操作，需要安装 nodejs 环境，适合新手不喜欢 docker 部署方式的用户

### [二进制文件快速部署](/docs/executable.md)

无需任何环境依赖，只需运行一个二进制文件，即可完成部署，使用守护进程，可视化操作，适合新手不喜欢 docker 部署方式的用户

### [Cloudflare Worker 快速部署](/docs/cloudflare-worker.md)

适合作为加密请求兜底入口、安卓 App 普通代理入口、以及多域名入口补充

## 自行构建和调试使用

### 1.克隆项目

```bash
   git clone
```

### 2. 安装依赖

```bash
   yarn install
```

### 3. 配置环境变量

```bash
   cp .env.example .env # 复制环境变量配置文件 => 生产环境使用
   cp .env.exampl .env.local # 复制环境变量配置文件 => 本地调试使用
```

### 4. 构建项目

```bash
   yarn run build # 构建 js 产物
   yarn run build:executable # 构建二进制文件
   docker build -t airsecurity . # 构建 docker 镜像
```

### 5. 运行项目

```bash
   yarn run start # 启动服务
   yarn run dev # 本地调试
   docker run -d --name airsecurity -p 3000:3000 airsecurity # 启动 docker 容器
```
