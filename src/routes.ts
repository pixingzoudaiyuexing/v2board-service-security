import type Koa from 'koa'
import type { PlanPeriodKey } from './services/backend'
import type { CaptchaType } from './types/captcha'
import * as process from 'node:process'
import KoaRouter from '@koa/router'
import chalk from 'chalk'
import {
  adminCreateUserEnabled,
  captchaKey,
  captchaLoginEnabled,
  captchaQuickOrderEnabled,
  captchaRegisterEnabled,
  domain,
  proxyConfig,
  smtpNewUserSubject,
} from './env'
import { BackendService } from './services/backend'
import { generateCaptchaData, generateCaptchaHash } from './services/captcha'
import { MailerService } from './services/mailer'
import { renderHtml } from './utlis'

export const router = new KoaRouter()

router.get('/healthz', async (ctx: Koa.Context) => {
  ctx.response.type = 'text/plain'
  ctx.response.status = 200
  ctx.response.body = 'ok'
})

/**
 * 免登获取套餐列表
 */
router.get('/api/v1/r8d/quick/plan', async (ctx: Koa.Context) => {
  try {
    ctx.response.body = await BackendService.instance.getPlanList()
  }
  catch (e) {
    console.error('getPlanList 500', e)
    ctx.response.status = 500
    ctx.response.body = {
      code: 500,
      message: '获取套餐列表失败',
    }
  }
})

/**
 * 免登获取订单支持的付款方式
 */
router.get('/api/v1/r8d/quick/payment', async (ctx: Koa.Context) => {
  try {
    ctx.response.body = await BackendService.instance.getOrderPayments()
  }
  catch (e) {
    console.error('getOrderDetail 500', e)
    ctx.response.status = 500
    ctx.response.body = {
      code: 500,
      message: '获取订单支持方式失败',
    }
  }
})

/**
 * 免登获取优惠券信息
 */
router.post('/api/v1/r8d/quick/coupon', async (ctx: Koa.Context) => {
  const data = ctx.request.body as { code: string, plan_id?: string, period?: PlanPeriodKey }
  console.log('优惠券验证请求体:', data)
  try {
    ctx.response.body = await BackendService.instance.getCouponData(data)
  }
  catch (error) {
    console.error('getCouponData 500', error)
    ctx.response.status = 500
    ctx.response.body = {
      code: 500,
      message: '获取优惠券信息失败',
    }
  }
})

/**
 * 获取验证码
 */
router.get('/api/v1/r8d/quick/captcha', async (ctx: Koa.Context) => {
  const captchaKey = process.env.CAPTCHA_KEY
  if (!captchaKey) {
    ctx.response.status = 200
    ctx.response.body = {
      data: null,
    }
    return
  }
  const { type } = ctx.request.query as { type: CaptchaType }
  // 根据类型检查是否启用验证码校验
  let hasCheck: boolean
  switch (type) {
    case 'quick':
      hasCheck = captchaQuickOrderEnabled
      break
    case 'register':
      hasCheck = captchaRegisterEnabled
      break
    case 'login':
      hasCheck = captchaLoginEnabled
      break
    default:
      hasCheck = false
      break
  }
  if (!hasCheck) {
    ctx.response.status = 200
    ctx.response.body = {
      data: null,
    }
    return
  }
  // 生成验证码数据
  try {
    const timestamp = Date.now()

    const { code, dataURL } = await generateCaptchaData()
    const hash = generateCaptchaHash({
      code,
      type,
      timestamp,
      captchaKey,
    })

    ctx.response.body = {
      data: dataURL,
      timestamp,
      hash,
    }
  }
  catch (e) {
    console.error('getCaptcha 500', e)
    ctx.response.status = 500
    ctx.response.body = {
      code: 500,
      message: '获取验证码失败',
    }
  }
})

/**
 * 创建免登订单
 */
router.post('/api/v1/r8d/quick/order', async (ctx: Koa.Context) => {
  const { email, password, planId, period, couponCode, inviteCode } = ctx.request.body as {
    planId: string
    period: PlanPeriodKey
    email: string
    password: string
    couponCode?: string
    inviteCode?: string
  }

  // 检查优惠券参数，并计算优惠券类型和金额
  if (couponCode) {
    const couponData = couponCode && await BackendService.instance.getCouponData({
      code: couponCode,
      plan_id: planId.toString(),
      period,
    })
    if (!couponData || !couponData.data || !couponData.data.value) {
      // eslint-disable-next-line ts/ban-ts-comment
      // @ts-expect-error
      const text = couponData.message || '优惠券无效'
      console.error('优惠券验证错误信息:', text)
      ctx.response.status = 500
      ctx.response.body = {
        code: 500,
        message: text,
      }
      return
    }
  }

  // 检查用户是否已存在
  const checkUserExist = await BackendService.instance.checkUser(email)
  if (checkUserExist) {
    console.error('用户已存在:', email)
    ctx.response.status = 500
    ctx.response.body = {
      code: 500,
      message: '用户已存在',
    }
    return
  }

  // 创建用户
  const authToken = adminCreateUserEnabled
    ? await BackendService.instance.createUserForAdmin({ email, password })
    : await BackendService.instance.createUser({ email, password, invite_code: inviteCode })
  console.log('createUser:', email, authToken)

  // 创建订单
  const order = await BackendService.instance.createOrder({
    token: authToken,
    plan_id: planId,
    period,
    coupon_code: couponCode,
  })
  console.log('createOrder:', email, order)

  // 发送新用户邮件
  const template = MailerService.instance.newUserTemplate
    ? {
        html: renderHtml(MailerService.instance.newUserTemplate, { email, password }),
      }
    : {
        text: `${smtpNewUserSubject}！\n\n您的账号信息：\n邮箱: ${email}\n密码: ${password}\n\n请妥善保管您的账号信息。`,
      }
  MailerService.instance.sendMail(email, smtpNewUserSubject || '通知', template).then(() => {
    console.log(chalk.bgGreen('SUCCESS:'), '发送新用户邮件成功:', email)
  }).catch((err) => {
    console.error(chalk.bgRed('ERROR:'), '发送新用户邮件失败:', email, err)
  })

  ctx.response.status = 200
  ctx.response.body = {
    authToken,
    orderId: order,
  }
})

// proxy
router.all('/api/v1/:segments*', async (ctx: Koa.Context) => {
  const headers = new Headers(ctx.request.headers as Record<string, string>)

  // 移除问题头
  const removeHeaders = [
    'x-salt',
    'content-length',
    'x-origin-content-type',
    'host',
  ]
  removeHeaders.forEach(h => headers.delete(h))

  // 代理请求解析
  const url = new URL(domain as string)
  const { query, path, body, rawBody } = ctx.request
  query && (url.search = new URLSearchParams(query as Record<string, string | readonly string[]>).toString())
  url.pathname = path
  console.log('代理转发请求:', `${ctx.method} ${url.toString()}`, 'path:', path, 'body:', body, 'rawBody:', rawBody)

  // 代理请求转发
  const response = await fetch(url, {
    method: ctx.method,
    headers,
    body: JSON.stringify(body),
    verbose: false, // 调试用，输出详细日志
    ...proxyConfig,
  })

  ctx.response.status = response.status
  ctx.response.body = await response.text()

  const omitHeaders = ['vary', 'transfer-encoding', 'content-length', 'content-encoding']
  for (const [key, value] of response.headers.entries()) {
    if (!omitHeaders.includes(key)) {
      ctx.response.set(key, value)
    }
  }
})
