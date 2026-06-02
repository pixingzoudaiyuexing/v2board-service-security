# Cloudflare Worker fallback

This is the Cloudflare Worker fallback build for `v2board-service-security` 1.1.3. It is designed to be used as the last `security.endpoints` entry in the frontend config when your primary security middleware is unavailable.

## What It Supports

- `/healthz` returns `ok`
- SHA-1 encrypted path mapping: `SHA-1(path + "#" + SEC_PASSWORD)`
- AES-128-GCM request decryption with `x-salt`
- AES-128-GCM response encryption when `x-encrypt-response` is present
- CORS headers for browser requests
- Proxying regular `/api/v1/*` requests to `BACKEND_DOMAIN`
- Plain HTTPS proxy compatibility for Android app requests
- Quick order helper APIs:
  - `/api/v1/r8d/quick/plan`
  - `/api/v1/r8d/quick/payment`
  - `/api/v1/r8d/quick/coupon`
  - `/api/v1/r8d/quick/captcha`
  - `/api/v1/r8d/quick/order`
- The original image captcha flow from 1.1.2

## What Is Different From The Bun Version

Cloudflare Workers cannot use the Node SMTP stack used by the Bun service, so this fallback does not send the new-user email after quick order creation.

The image captcha is generated as an SVG data URL instead of the Bun version's PNG generator. The hash and validation logic are the same:

```text
sha256(timestamp + lower_case_code + type + CAPTCHA_KEY)
```

## Required Variables

Set these Worker variables in Cloudflare:

```text
BACKEND_DOMAIN=https://your-backend.example.com
BACKEND_PANEL=v2b
ADMIN_API_PREFIX=your-admin-prefix
ADMIN_CREATE_USER_ENABLED=false
CAPTCHA_QUICK_ORDER_ENABLED=true
CAPTCHA_REGISTER_ENABLED=true
CAPTCHA_LOGIN_ENABLED=false
ENCRYPTED_REQUEST_ONLY=false
```

Set these as Worker secrets:

```text
SEC_PASSWORD=the same password used by frontend config.js
ADMIN_EMAIL=your admin email
ADMIN_PASSWORD=your admin password
CAPTCHA_KEY=your captcha key
```

If you do not use the quick order API, the admin variables can be omitted, but regular encrypted proxy requests still require `BACKEND_DOMAIN` and `SEC_PASSWORD`.

## Deploy

From this directory:

```bash
npx wrangler deploy
```

Set secrets with:

```bash
npx wrangler secret put SEC_PASSWORD
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put CAPTCHA_KEY
```

## Frontend Config

Put the Worker URL at the end of `security.endpoints`:

```js
security: {
  endpoints: [
    "https://anquan.mengtuyun.online",
    "https://your-worker.your-subdomain.workers.dev",
  ],
}
```

The frontend will use the Worker only after the earlier security entries fail.
