const encoder = new TextEncoder();
const decoder = new TextDecoder();

const CAPTCHA_PATHS = {
  "/api/v1/r8d/quick/order": "quick",
  "/api/v1/passport/auth/register": "register",
  "/api/v1/passport/auth/login": "login",
};

const HASHED_PATHS = [
  "/api/v1/user/notice/fetch",
  "/api/v1/user/info",
  "/api/v1/user/comm/config",
  "/api/v1/guest/comm/config",
  "/api/v1/user/plan/fetch",
  "/api/v1/user/order/fetch",
  "/api/v1/user/order/detail",
  "/api/v1/user/server/fetch",
  "/api/v1/user/knowledge/fetch",
  "/api/v1/user/knowledge/fetch",
  "/api/v1/user/invite/save",
  "/api/v1/user/invite/fetch",
  "/api/v1/user/invite/details",
  "/api/v1/user/ticket/fetch",
  "/api/v1/user/ticket/fetch",
  "/api/v1/bing/vip",
  "/api/v1/user/getSubscribe",
  "/api/v1/user/newPeriod",
  "/api/v1/user/order/getPaymentMethod",
  "/api/v1/user/stat/getTrafficLog",
  "/api/v1/user/getStat",
  "/api/v1/user/resetSecurity",
  "/api/v1/user/coupon/check",
  "/api/v1/user/order/save",
  "/api/v1/user/order/checkout",
  "/api/v1/user/order/cancel",
  "/api/v1/user/update",
  "/api/v1/user/update",
  "/api/v1/user/transfer",
  "/api/v1/user/ticket/withdraw",
  "/api/v1/user/redeemgiftcard",
  "/api/v1/user/ticket/save",
  "/api/v1/user/ticket/close",
  "/api/v1/user/ticket/reply",
  "/api/v1/passport/auth/login",
  "/api/v1/user/logout",
  "/api/v1/passport/auth/check",
  "/api/v1/passport/auth/register",
  "/api/v1/user/changePassword",
  "/api/v1/passport/auth/forget",
  "/api/v1/passport/comm/sendEmailVerify",
  "/api/v1/passport/auth/token2Login",
  "/api/v1/r8d/quick/plan",
  "/api/v1/r8d/quick/payment",
  "/api/v1/r8d/quick/coupon",
  "/api/v1/r8d/quick/captcha",
  "/api/v1/r8d/quick/order",
];

const pathMapCache = new Map();
const aesKeyCache = new Map();
let cachedAdminToken = "";
let cachedAdminTokenAt = 0;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return addCors(new Response(null, { status: 204 }), request);
    }

    try {
      if (new URL(request.url).pathname === "/healthz") {
        return addCors(new Response("ok", {
          headers: { "content-type": "text/plain; charset=utf-8" },
        }), request);
      }

      const context = await normalizeRequest(request, env);
      let response;

      if (context.pathname === "/api/v1/r8d/quick/plan" && context.method === "GET") {
        response = await handleQuickPlan(env);
      } else if (context.pathname === "/api/v1/r8d/quick/payment" && context.method === "GET") {
        response = await handleQuickPayment(env);
      } else if (context.pathname === "/api/v1/r8d/quick/coupon" && context.method === "POST") {
        response = await handleQuickCoupon(env, context.bodyJson);
      } else if (context.pathname === "/api/v1/r8d/quick/captcha" && context.method === "GET") {
        response = await handleQuickCaptcha(env, context.url.searchParams.get("type"));
      } else if (context.pathname === "/api/v1/r8d/quick/order" && context.method === "POST") {
        response = await handleQuickOrder(env, context.bodyJson);
      } else if (context.pathname === "/api/v1/config" && context.method === "GET") {
        response = await handleCompatConfig(env);
      } else if (context.pathname === "/api/v1/plan" && context.method === "GET") {
        response = await handleCompatPlan(env);
      } else if (context.pathname === "/api/v1/node" && context.method === "GET") {
        response = await handleCompatNode(env, context.url.searchParams.get("t") || "1");
      } else if (context.pathname === "/api/v1/client/app/getVersion" && context.method === "GET") {
        response = await handleCompatVersion(env, context.url.searchParams.get("token") || "");
      } else if (context.pathname.startsWith("/api/v1/")) {
        await checkCaptchaIfNeeded(env, context);
        response = await proxyToBackend(env, context);
      } else {
        response = json({ code: 404, message: "Not found" }, 404);
      }

      return addCors(await maybeEncryptResponse(request, env, response, context), request);
    } catch (error) {
      const status = Number(error && error.status) || 500;
      const message = error && error.message ? error.message : "Internal error";
      return addCors(json({ code: status, message }, status), request);
    }
  },
};

async function normalizeRequest(request, env) {
  requireEnv(env, "BACKEND_DOMAIN");
  requireEnv(env, "SEC_PASSWORD");

  const sourceUrl = new URL(request.url);
  const headers = new Headers(request.headers);
  const saltText = headers.get("x-salt") || "";

  if (isTrue(env.ENCRYPTED_REQUEST_ONLY) && !saltText) {
    throw new HttpError(403, "Forbidden");
  }

  const saltBytes = saltText ? base64ToBytes(saltText) : null;
  let pathname = sourceUrl.pathname;
  const query = new URLSearchParams(sourceUrl.search);
  let rawBody = null;
  let forwardBody = undefined;
  let bodyJson = null;

  if (request.method !== "GET" && request.method !== "HEAD") {
    rawBody = await request.text();
    forwardBody = rawBody || undefined;
  }

  if (saltBytes) {
    pathname = await parsePathname(env, pathname);

    const encryptedQuery = query.get("q");
    query.delete("q");
    if (encryptedQuery) {
      const plainQuery = await decryptText(env, base64ToBytes(encryptedQuery), saltBytes);
      try {
        const parsed = JSON.parse(plainQuery);
        for (const [key, value] of Object.entries(parsed)) {
          if (value == null) continue;
          query.set(key, String(value));
        }
      } catch {
        // Keep the original query if it is not JSON.
      }
    }

    const originContentType = headers.get("x-origin-content-type") || "";
    const contentType = headers.get("content-type") || "";
    if (rawBody && originContentType.includes("application/json") && contentType.includes("text/plain")) {
      forwardBody = await decryptText(env, base64ToBytes(rawBody), saltBytes);
      headers.set("content-type", originContentType);
    }
  }

  if (forwardBody && (headers.get("content-type") || "").includes("application/json")) {
    try {
      bodyJson = JSON.parse(forwardBody);
    } catch {
      bodyJson = null;
    }
  }

  const url = new URL(sourceUrl.href);
  url.pathname = pathname;
  url.search = query.toString() ? `?${query.toString()}` : "";

  return {
    bodyJson,
    forwardBody,
    headers,
    method: request.method,
    pathname,
    saltBytes,
    saltText,
    url,
  };
}

async function handleQuickPlan(env) {
  const data = await backendJson(env, "/api/v1/user/plan/fetch", {
    method: "GET",
    token: await getAdminToken(env),
  });
  return json(data.data || []);
}

async function handleQuickPayment(env) {
  const data = await backendJson(env, "/api/v1/user/order/getPaymentMethod", {
    method: "GET",
    token: await getAdminToken(env),
  });
  return json(data.data || []);
}

async function handleQuickCoupon(env, body) {
  const data = await backendJson(env, "/api/v1/user/coupon/check", {
    method: "POST",
    token: await getAdminToken(env),
    body,
  });
  return json(data);
}

async function handleQuickCaptcha(env, type) {
  if (!env.CAPTCHA_KEY || !captchaEnabled(env, type)) {
    return json({ data: null });
  }

  const timestamp = Date.now();
  const code = String(Math.floor(Math.random() * 9000) + 1000);
  return json({
    data: svgCaptchaDataUrl(code),
    timestamp,
    hash: await captchaHash(env, { code, type, timestamp }),
  });
}

async function handleQuickOrder(env, body) {
  await checkCaptcha(env, "quick", body && body.captcha);

  const { email, password, planId, period, couponCode, inviteCode } = body || {};
  if (!email || !password || !planId || !period) {
    return json({ code: 500, message: "参数不完整" }, 500);
  }

  if (couponCode) {
    const couponData = await backendJson(env, "/api/v1/user/coupon/check", {
      method: "POST",
      token: await getAdminToken(env),
      body: { code: couponCode, plan_id: String(planId), period },
    });
    if (!couponData || !couponData.data || !couponData.data.value) {
      return json({ code: 500, message: (couponData && couponData.message) || "优惠券无效" }, 500);
    }
  }

  if (await checkUser(env, email)) {
    return json({ code: 500, message: "用户已存在" }, 500);
  }

  const authToken = isTrue(env.ADMIN_CREATE_USER_ENABLED)
    ? await createUserForAdmin(env, email, password)
    : await createUser(env, email, password, inviteCode);

  const orderId = await createOrder(env, authToken, planId, period, couponCode);
  return json({ authToken, orderId });
}

async function handleCompatConfig(env) {
  try {
    const [guestConfig, userConfig] = await Promise.all([
      backendJson(env, "/api/v1/guest/comm/config", { method: "GET" }),
      backendJson(env, "/api/v1/user/comm/config", {
        method: "GET",
        token: await getAdminToken(env),
      }).catch(() => ({ data: {} })),
    ]);
    return json({
      data: {
        ...(guestConfig.data || {}),
        ...(userConfig.data || {}),
      },
    });
  } catch {
    return json({ data: {} });
  }
}

async function handleCompatPlan(env) {
  try {
    const data = await backendJson(env, "/api/v1/user/plan/fetch", {
      method: "GET",
      token: await getAdminToken(env),
    });
    return json({ data: data.data || [] });
  } catch {
    return json({ data: [] });
  }
}

async function handleCompatNode(env, t) {
  try {
    const data = await backendJson(env, `/api/v1/user/server/fetch?t=${encodeURIComponent(t)}`, {
      method: "GET",
      token: await getAdminToken(env),
    });
    return json({ data: data.data || [] });
  } catch {
    return json({ data: [] });
  }
}

async function handleCompatVersion(env, token) {
  try {
    const suffix = token ? `?token=${encodeURIComponent(token)}` : "";
    const data = await backendJson(env, `/api/v1/client/app/getVersion${suffix}`, {
      method: "GET",
      token: token || undefined,
    });
    return json({ data: data.data || emptyVersionData() });
  } catch {
    return json({ data: emptyVersionData() });
  }
}

function emptyVersionData() {
  return {
    windows_version: null,
    windows_download_url: null,
    macos_version: null,
    macos_download_url: null,
    android_version: null,
    android_download_url: null,
  };
}

async function checkCaptchaIfNeeded(env, context) {
  const type = CAPTCHA_PATHS[context.pathname];
  if (!type || !env.CAPTCHA_KEY) return;

  await checkCaptcha(env, type, context.bodyJson && context.bodyJson.captcha);
  if (context.bodyJson && typeof context.bodyJson === "object") {
    delete context.bodyJson.captcha;
    context.forwardBody = JSON.stringify(context.bodyJson);
  }
}

async function checkCaptcha(env, type, captcha) {
  if (!env.CAPTCHA_KEY || !captchaEnabled(env, type)) return true;

  if (!captcha || !captcha.code || !captcha.type || !captcha.timestamp || !captcha.hash) {
    throw new HttpError(500, "缺少验证码");
  }
  if (captcha.type !== type) {
    throw new HttpError(500, "验证码类型不匹配");
  }
  if (Date.now() - Number(captcha.timestamp) > 5 * 60 * 1000) {
    throw new HttpError(500, "验证码已过期");
  }

  const expected = await captchaHash(env, {
    code: String(captcha.code),
    type,
    timestamp: Number(captcha.timestamp),
  });
  if (expected !== captcha.hash) {
    throw new HttpError(500, "验证码无效");
  }

  return true;
}

async function proxyToBackend(env, context) {
  const url = backendUrl(env, context.pathname);
  url.search = context.url.search;

  const init = {
    headers: forwardHeaders(context.headers),
    method: context.method,
  };
  if (context.method !== "GET" && context.method !== "HEAD") {
    init.body = context.forwardBody == null ? "" : context.forwardBody;
  }

  return fetch(url.toString(), init);
}

async function checkUser(env, email) {
  const panel = env.BACKEND_PANEL || "v2b";
  const token = await getAdminToken(env);

  if (panel === "xb") {
    const result = await backendJson(env, adminPath(env, "user/fetch"), {
      method: "POST",
      token,
      body: {
        current: 1,
        pageSize: 20,
        sort: [],
        filter: [{ id: "email", value: `eq:${email}` }],
      },
    });
    return !!(result.data && result.data[0]);
  }

  const params = new URLSearchParams({
    "filter[0][key]": "email",
    "filter[0][condition]": "模糊",
    "filter[0][value]": email,
  });
  const result = await backendJson(env, `${adminPath(env, "user/fetch")}?${params.toString()}`, {
    method: "GET",
    token,
  });
  return !!(result.data && result.data[0]);
}

async function createUser(env, email, password, inviteCode) {
  const result = await backendJson(env, "/api/v1/passport/auth/register", {
    method: "POST",
    body: {
      email,
      password,
      ...(inviteCode ? { invite_code: inviteCode } : {}),
    },
  });
  return result.data && (result.data.auth_data || result.data.token);
}

async function createUserForAdmin(env, email, password) {
  const panel = env.BACKEND_PANEL || "v2b";
  const [emailPrefix, emailSuffix] = String(email).split("@");
  const token = await getAdminToken(env);
  const body = {
    email_prefix: emailPrefix,
    email_suffix: emailSuffix,
    password,
  };

  const response = await fetch(backendUrl(env, adminPath(env, "user/generate")).toString(), {
    method: "POST",
    headers: {
      authorization: token,
      "content-type": panel === "xb" ? "application/json" : "application/x-www-form-urlencoded",
    },
    body: panel === "xb" ? JSON.stringify(body) : new URLSearchParams(body).toString(),
  });
  const result = await response.json();
  if (result.data !== true) {
    throw new HttpError(500, "Admin 创建用户失败");
  }

  const login = await backendJson(env, "/api/v1/passport/auth/login", {
    method: "POST",
    body: { email, password },
  });
  return login.data && (login.data.auth_data || login.data.token);
}

async function createOrder(env, token, planId, period, couponCode) {
  const result = await backendJson(env, "/api/v1/user/order/save", {
    method: "POST",
    token,
    body: {
      plan_id: String(planId),
      period,
      ...(couponCode ? { coupon_code: couponCode } : {}),
    },
  });
  return result.data;
}

async function getAdminToken(env) {
  requireEnv(env, "ADMIN_API_PREFIX");
  requireEnv(env, "ADMIN_EMAIL");
  requireEnv(env, "ADMIN_PASSWORD");

  if (cachedAdminToken && Date.now() - cachedAdminTokenAt < 20 * 60 * 1000) {
    return cachedAdminToken;
  }

  const result = await backendJson(env, "/api/v1/passport/auth/login", {
    method: "POST",
    body: {
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD,
    },
  });
  cachedAdminToken = result.data && (result.data.auth_data || result.data.token);
  cachedAdminTokenAt = Date.now();
  if (!cachedAdminToken) {
    throw new HttpError(500, "AdminToken 初始化失败");
  }
  return cachedAdminToken;
}

async function backendJson(env, path, options = {}) {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.token) headers.set("authorization", options.token);

  const response = await fetch(backendUrl(env, path).toString(), {
    method: options.method || "GET",
    headers,
    body: options.body == null ? undefined : JSON.stringify(options.body),
  });
  return response.json();
}

function backendUrl(env, path) {
  const url = new URL(env.BACKEND_DOMAIN);
  if (/^https?:\/\//i.test(path)) return new URL(path);
  const [pathname, search = ""] = String(path).split("?");
  url.pathname = pathname;
  url.search = search ? `?${search}` : "";
  return url;
}

function adminPath(env, api) {
  const panel = env.BACKEND_PANEL || "v2b";
  return `/api/${panel === "xb" ? "v2" : "v1"}/${env.ADMIN_API_PREFIX}/${api}`;
}

function forwardHeaders(source) {
  const headers = new Headers(source);
  for (const key of ["x-salt", "content-length", "x-origin-content-type", "host"]) {
    headers.delete(key);
  }
  return headers;
}

async function maybeEncryptResponse(request, env, response, context) {
  if (!context.saltText || !context.saltBytes || !request.headers.get("x-encrypt-response")) {
    return response;
  }

  const raw = await response.text();
  const encrypted = await encryptText(env, raw, context.saltBytes);
  const headers = new Headers(response.headers);

  for (const key of ["date", "content-type", "content-encoding"]) {
    const value = headers.get(key);
    if (value) headers.set(`x-origin-${key}`, value);
  }
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.set("content-type", "text/plain; charset=utf-8");
  headers.set("x-salt", context.saltText);
  headers.set("x-encrypt-response", "1");

  return new Response(encrypted, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function parsePathname(env, pathname) {
  const map = await getPathMap(env);
  return map[pathname] || pathname;
}

async function getPathMap(env) {
  const password = env.SEC_PASSWORD || "";
  if (pathMapCache.has(password)) return pathMapCache.get(password);

  const entries = await Promise.all(HASHED_PATHS.map(async (pathname) => {
    const digest = await crypto.subtle.digest("SHA-1", encoder.encode(`${pathname}#${password}`));
    return [`/${bytesToHex(new Uint8Array(digest))}`, pathname];
  }));
  const map = Object.fromEntries(entries);
  pathMapCache.set(password, map);
  return map;
}

async function getAesKey(env) {
  const password = env.SEC_PASSWORD || "";
  if (aesKeyCache.has(password)) return aesKeyCache.get(password);

  const passwordBytes = encoder.encode(password);
  const keyMaterial = await crypto.subtle.importKey("raw", passwordBytes, "PBKDF2", false, [
    "deriveBits",
    "deriveKey",
  ]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: passwordBytes, iterations: 10000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 128 },
    true,
    ["encrypt", "decrypt"],
  );
  aesKeyCache.set(password, key);
  return key;
}

async function decryptText(env, encryptedBytes, saltBytes) {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", length: 128, iv: saltBytes },
    await getAesKey(env),
    encryptedBytes,
  );
  return decoder.decode(plain);
}

async function encryptText(env, text, saltBytes) {
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", length: 128, iv: saltBytes },
    await getAesKey(env),
    encoder.encode(text),
  );
  return bytesToBase64(new Uint8Array(encrypted));
}

async function captchaHash(env, options) {
  const text = `${options.timestamp}${String(options.code).toLowerCase()}${options.type}${env.CAPTCHA_KEY || ""}`;
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return bytesToBase64(new Uint8Array(digest));
}

function captchaEnabled(env, type) {
  if (type === "quick") return isTrue(env.CAPTCHA_QUICK_ORDER_ENABLED);
  if (type === "register") return isTrue(env.CAPTCHA_REGISTER_ENABLED);
  if (type === "login") return isTrue(env.CAPTCHA_LOGIN_ENABLED);
  return false;
}

function svgCaptchaDataUrl(code) {
  const chars = String(code).split("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="60" viewBox="0 0 180 60">
<rect width="180" height="60" rx="8" fill="#edf7f5"/>
<path d="M8 18 C42 5, 74 34, 118 15 S160 9, 174 29" fill="none" stroke="#23b79c" stroke-width="2" opacity=".36"/>
<path d="M6 44 C42 34, 80 56, 128 38 S158 32, 174 45" fill="none" stroke="#2f7dd1" stroke-width="2" opacity=".28"/>
${chars.map((char, index) => {
  const x = 28 + index * 34;
  const y = 39 + Math.round((Math.random() - 0.5) * 8);
  const rotate = Math.round((Math.random() - 0.5) * 18);
  return `<text x="${x}" y="${y}" transform="rotate(${rotate} ${x} ${y})" font-size="30" font-weight="700" font-family="Arial, sans-serif" fill="#183f39">${char}</text>`;
}).join("")}
</svg>`;
  return `data:image/svg+xml;base64,${bytesToBase64(encoder.encode(svg))}`;
}

function addCors(response, request) {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", request.headers.get("origin") || "*");
  headers.set("access-control-allow-methods", "GET,POST,PUT,DELETE,OPTIONS");
  headers.set("access-control-allow-headers", "x-salt,x-encrypt-response,x-origin-content-type,authorization,content-type");
  headers.set("access-control-expose-headers", "x-salt,x-encrypt-response,x-origin-content-type,authorization,content-type,x-origin-date,x-origin-content-type,x-origin-content-encoding");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function requireEnv(env, key) {
  if (!env[key]) throw new HttpError(500, `${key} 未配置`);
}

function isTrue(value) {
  return String(value || "").toLowerCase() === "true";
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function bytesToHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
