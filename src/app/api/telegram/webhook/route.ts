import { createServiceClient } from '@/lib/supabase/server'

interface TelegramUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
}

interface TelegramMessage {
  text?: string
  chat?: {
    id: number
  }
  from?: TelegramUser
}

interface TelegramUpdate {
  message?: TelegramMessage
}

const START_LOGIN_PATTERN = /^\/start(?:@\w+)?\s+login_([A-Za-z0-9_-]{20,})$/

type ReplyMarkup = {
  inline_keyboard: Array<Array<{ text: string; url: string }>>
}

async function sendBotMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: ReplyMarkup
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup }),
  })
}

async function isGroupMember(botToken: string, telegramUserId: number): Promise<boolean> {
  const groupId = process.env.TELEGRAM_GROUP_ID
  if (!groupId) return true

  const memberRes = await fetch(
    `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${groupId}&user_id=${telegramUserId}`
  )
  const memberData = await memberRes.json() as { ok: boolean; result?: { status?: string } }
  const status = memberData.result?.status
  const isMember =
    memberData.ok &&
    status !== undefined &&
    ['member', 'administrator', 'creator'].includes(status)

  if (!isMember) {
    console.error('[auth] getChatMember failed:', {
      groupId,
      userId: telegramUserId,
      ok: memberData.ok,
      status,
    })
  }

  return isMember
}

export async function POST(request: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return Response.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (secret) {
    const incomingSecret = request.headers.get('x-telegram-bot-api-secret-token')
    if (incomingSecret !== secret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const update = await request.json().catch(() => null) as TelegramUpdate | null
  const message = update?.message
  const text = message?.text ?? ''
  const chatId = message?.chat?.id
  const from = message?.from
  if (!chatId || !from) {
    return Response.json({ ok: true })
  }

  const match = text.match(START_LOGIN_PATTERN)
  if (!match) {
    return Response.json({ ok: true })
  }

  const loginToken = match[1]
  const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  const supabase = createServiceClient()
  const { data: loginRequest, error } = await supabase
    .from('telegram_login_requests')
    .select('*')
    .eq('token', loginToken)
    .single()

  if (error || !loginRequest) {
    await sendBotMessage(botToken, chatId, 'Este enlace de acceso no es valido o ya no existe.')
    return Response.json({ ok: true })
  }

  if (loginRequest.status === 'consumed') {
    await sendBotMessage(
      botToken,
      chatId,
      'Este acceso ya fue utilizado. Puedes volver al navegador y solicitar uno nuevo.',
      { inline_keyboard: [[{ text: 'Abrir Club Dragon', url: `${appOrigin}/login` }]] }
    )
    return Response.json({ ok: true })
  }

  if (loginRequest.status === 'approved' && loginRequest.telegram_id === from.id) {
    await sendBotMessage(
      botToken,
      chatId,
      `Acceso ya confirmado. Vuelve a Safari (o al navegador original) para terminar el login.\nSi has cerrado esa pestaña, abre ${appOrigin}/login y vuelve a iniciar el acceso.`
    )
    return Response.json({ ok: true })
  }

  if (new Date(loginRequest.expires_at).getTime() < Date.now()) {
    await supabase
      .from('telegram_login_requests')
      .update({ status: 'rejected' })
      .eq('token', loginToken)
      .eq('status', 'pending')
    await sendBotMessage(botToken, chatId, 'Este enlace ha expirado. Vuelve a iniciar sesion desde la web.')
    return Response.json({ ok: true })
  }

  const member = await isGroupMember(botToken, from.id)
  if (!member) {
    await sendBotMessage(
      botToken,
      chatId,
      'No hemos podido validar tu acceso al grupo requerido. Si ya eres miembro, pide a un admin que revise el bot.'
    )
    return Response.json({ ok: true })
  }

  await supabase
    .from('telegram_login_requests')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      telegram_id: from.id,
      telegram_username: from.username ?? null,
      telegram_first_name: from.first_name,
      telegram_last_name: from.last_name ?? null,
      telegram_photo_url: from.photo_url ?? null,
    })
    .eq('token', loginToken)
    .eq('status', 'pending')

  await sendBotMessage(
    botToken,
    chatId,
    'Acceso confirmado. Vuelve a Safari (o al navegador original) para terminar el login.'
  )

  return Response.json({ ok: true })
}
