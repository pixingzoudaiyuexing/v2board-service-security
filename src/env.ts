export const encoder = new TextEncoder()
export const port = process.env.PORT || 3000
// 必备环境变量
export const panel = process.env.BACKEND_PANEL as 'v2b' | 'xb' || 'v2b'
export const domain = process.env.BACKEND_DOMAIN
export const password = process.env.SEC_PASSWORD

// 用于实现免登接口的管理面板的环境变量
export const adminApi = process.env.ADMIN_API_PREFIX
export const adminEmail = process.env.ADMIN_EMAIL
export const adminPassword = process.env.ADMIN_PASSWORD
export const adminCreateUserEnabled = process.env.ADMIN_CREATE_USER_ENABLED === 'true'

// 邮件服务的环境变量
export const smtpHost = process.env.MAIL_HOST
export const smtpPort = process.env.MAIL_PORT
export const smtpSecure = process.env.MAIL_SECURE === 'true'
export const smtpUser = process.env.MAIL_USER
export const smtpPassword = process.env.MAIL_PASS
export const smtpNewUserSubject = process.env.MAIL_NEWUSER_SUBJECT
export const smtpNewUserTemplate = process.env.MAIL_NEWUSER_URL
// 图形验证码相关环境变量
export const captchaKey = process.env.CAPTCHA_KEY
export const captchaQuickOrderEnabled = process.env.CAPTCHA_QUICK_ORDER_ENABLED === 'true'
export const captchaRegisterEnabled = process.env.CAPTCHA_REGISTER_ENABLED === 'true'
export const captchaLoginEnabled = process.env.CAPTCHA_LOGIN_ENABLED === 'true'
// 安全设置
export const encryptedRequestOnly = process.env.ENCRYPTED_REQUEST_ONLY === 'true'

// 动态代理配置
export const proxyConfig = process.env.PROXY_URL
  ? { proxy: process.env.PROXY_URL }
  : {}
const passwordBuffer = encoder.encode(password)

const pbkdf2Key = await crypto.subtle.importKey(
  'raw',
  passwordBuffer,
  'PBKDF2',
  false,
  ['deriveBits', 'deriveKey'],
)

export const aesKey = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', salt: passwordBuffer, iterations: 10000, hash: 'SHA-256' },
  pbkdf2Key,
  { name: 'AES-GCM', length: 128 },
  true,
  ['encrypt', 'decrypt'],
)

const originalPathnameList = [
  '/api/v1/user/notice/fetch',
  '/api/v1/user/info',
  '/api/v1/user/comm/config',
  '/api/v1/guest/comm/config',
  '/api/v1/user/plan/fetch',
  '/api/v1/user/order/fetch',
  '/api/v1/user/order/detail',
  '/api/v1/user/server/fetch',
  '/api/v1/user/knowledge/fetch',
  '/api/v1/user/knowledge/fetch',
  '/api/v1/user/invite/save',
  '/api/v1/user/invite/fetch',
  '/api/v1/user/invite/details',
  '/api/v1/user/ticket/fetch',
  '/api/v1/user/ticket/fetch',
  '/api/v1/bing/vip',
  '/api/v1/user/getSubscribe',
  '/api/v1/user/newPeriod',
  '/api/v1/user/order/getPaymentMethod',
  '/api/v1/user/stat/getTrafficLog',
  '/api/v1/user/getStat',
  '/api/v1/user/resetSecurity',
  '/api/v1/user/coupon/check',
  '/api/v1/user/order/save',
  '/api/v1/user/order/checkout',
  '/api/v1/user/order/cancel',
  '/api/v1/user/update',
  '/api/v1/user/update',
  '/api/v1/user/transfer',
  '/api/v1/user/ticket/withdraw',
  '/api/v1/user/redeemgiftcard',
  '/api/v1/user/ticket/save',
  '/api/v1/user/ticket/close',
  '/api/v1/user/ticket/reply',
  '/api/v1/passport/auth/login',
  '/api/v1/user/logout',
  '/api/v1/passport/auth/check',
  '/api/v1/passport/auth/register',
  '/api/v1/user/changePassword',
  '/api/v1/passport/auth/forget',
  '/api/v1/passport/comm/sendEmailVerify',
  '/api/v1/passport/auth/token2Login',

  // 自定义接口
  '/api/v1/r8d/quick/plan', // 免登获取套餐列表
  '/api/v1/r8d/quick/payment', // 免登获取付款方式
  '/api/v1/r8d/quick/coupon', // 免登获取优惠券信息
  '/api/v1/r8d/quick/captcha', // 获取图形验证码
  '/api/v1/r8d/quick/order', // 创建免登订单
]

async function genPathnameMap() {
  const results = await Promise.all(originalPathnameList.map(async (pathname) => {
    return [pathname, await crypto.subtle.digest('SHA-1', encoder.encode(`${pathname}#${password}`))] as const
  }))
  return results.reduce((acc, [pathname, hash]) => {
    acc[`/${Buffer.from(hash).toString('hex')}`] = pathname
    return acc
  }, {} as Record<string, string>)
}

export const pathnameMap = await genPathnameMap()
console.log('pathnameMap', pathnameMap)
