import { Bot } from 'grammy'
import type { Tables } from '@/types/database'

type User = Tables<'users'>
type Session = Tables<'sessions'>
type Game = Tables<'games'>
type StoredGame = Tables<'stored_games'>
type MesaFijaRequest = Tables<'mesa_fija_requests'>

function getBot(): Bot | null {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || token.includes('placeholder')) return null
  return new Bot(token)
}

function formatDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatTime(time: string | null): string {
  if (!time) return ''
  return ` a las ${time.slice(0, 5)}`
}

async function safeSend(bot: Bot, telegramId: number, message: string): Promise<void> {
  try {
    await bot.api.sendMessage(telegramId, message, { parse_mode: 'HTML' })
  } catch (e) {
    // User may have blocked the bot — log but don't throw
    console.error(`[bot] Failed to send message to ${telegramId}:`, e)
  }
}

export async function sendNewSessionNotification(
  user: User,
  session: Session,
  game: Game | null
): Promise<void> {
  const bot = getBot()
  if (!bot) return

  const gameName = game?.name ?? 'Juego desconocido'
  const spots = session.max_players - 1 // host already in
  const message = [
    `🎲 <b>Nueva partida: ${gameName}</b>`,
    ``,
    `📅 ${formatDate(session.scheduled_date)}${formatTime(session.scheduled_time_start)}`,
    `📍 ${session.location_type === 'club' ? 'Club Dragón' : session.location_type}`,
    `👥 ${spots} plazas disponibles (${session.min_players}–${session.max_players} jugadores)`,
    session.title ? `📌 ${session.title}` : '',
    ``,
    `¿Te apuntas? Entra en la app del club para unirte.`,
  ].filter(Boolean).join('\n')

  await safeSend(bot, user.telegram_id, message)
}

export async function sendJoinNotification(
  host: User,
  joiner: User,
  session: Session
): Promise<void> {
  const bot = getBot()
  if (!bot) return

  const message = [
    `🙋 <b>${joiner.display_name}</b> se ha apuntado a tu partida`,
    `📅 ${formatDate(session.scheduled_date)}`,
  ].join('\n')

  await safeSend(bot, host.telegram_id, message)
}

export async function sendConfirmedNotification(
  participants: User[],
  session: Session,
  game: Game | null
): Promise<void> {
  const bot = getBot()
  if (!bot) return

  const gameName = game?.name ?? 'la partida'
  const message = [
    `✅ <b>¡Partida confirmada! ${gameName}</b>`,
    ``,
    `📅 ${formatDate(session.scheduled_date)}${formatTime(session.scheduled_time_start)}`,
    `📍 ${session.location_type === 'club' ? 'Club Dragón' : session.location_type}`,
    ``,
    `Tenéis suficientes jugadores. ¡Nos vemos!`,
  ].join('\n')

  for (const user of participants) {
    await safeSend(bot, user.telegram_id, message)
  }
}

export async function sendCancelledNotification(
  participants: User[],
  session: Session,
  game: Game | null
): Promise<void> {
  const bot = getBot()
  if (!bot) return

  const gameName = game?.name ?? 'la partida'
  const message = [
    `❌ <b>Partida cancelada: ${gameName}</b>`,
    ``,
    `📅 ${formatDate(session.scheduled_date)}`,
    ``,
    `El host ha cancelado la partida. Disculpa las molestias.`,
  ].join('\n')

  for (const user of participants) {
    await safeSend(bot, user.telegram_id, message)
  }
}

export async function sendStorageWarningNotification(
  players: User[],
  storedGame: StoredGame,
  game: Game | null,
  daysLeft: number
): Promise<void> {
  const bot = getBot()
  if (!bot) return

  const gameName = game?.name ?? 'tu tablero'
  const message = [
    `🟡 <b>Aviso: ${gameName} lleva mucho tiempo sin jugarse</b>`,
    ``,
    `⏳ Quedan aproximadamente <b>${daysLeft} días</b> antes de que el tablero sea retirado.`,
    `🗂 Accede a la app para registrar una sesión y mantener el tablero.`,
  ].join('\n')

  for (const user of players) {
    await safeSend(bot, user.telegram_id, message)
  }
}

export async function sendStorageCriticalNotification(
  players: User[],
  storedGame: StoredGame,
  game: Game | null,
  daysLeft: number
): Promise<void> {
  const bot = getBot()
  if (!bot) return

  const gameName = game?.name ?? 'tu tablero'
  const message = [
    `🔴 <b>¡URGENTE! ${gameName} será retirado en ${daysLeft} días</b>`,
    ``,
    `⚠️ Si no registráis una sesión pronto, el tablero será evacuado del slot.`,
    `🗂 Registra una sesión ahora en la app del club.`,
  ].join('\n')

  for (const user of players) {
    await safeSend(bot, user.telegram_id, message)
  }
}

export async function sendStorageExpiredNotification(
  players: User[],
  admins: User[],
  storedGame: StoredGame,
  game: Game | null
): Promise<void> {
  const bot = getBot()
  if (!bot) return

  const gameName = game?.name ?? 'el tablero'
  const playerMessage = [
    `💀 <b>${gameName}: tablero expirado</b>`,
    ``,
    `Han pasado más de 80 días desde la última sesión. El tablero ha expirado y será retirado por los admins del club.`,
    `Contactad con un admin si necesitáis más tiempo.`,
  ].join('\n')

  const adminMessage = [
    `⚠️ <b>ADMIN: Tablero expirado — ${gameName}</b>`,
    ``,
    `El tablero ha superado los 80 días sin actividad y necesita ser retirado.`,
  ].join('\n')

  for (const user of players) {
    await safeSend(bot, user.telegram_id, playerMessage)
  }
  for (const admin of admins) {
    await safeSend(bot, admin.telegram_id, adminMessage)
  }
}

export async function sendStorageEvictedNotification(
  players: User[],
  storedGame: StoredGame,
  game: Game | null
): Promise<void> {
  const bot = getBot()
  if (!bot) return

  const gameName = game?.name ?? 'vuestro tablero'
  const message = [
    `🗑 <b>${gameName}: tablero retirado por admin</b>`,
    ``,
    `Un administrador del club ha retirado vuestro tablero del slot de almacenamiento.`,
  ].join('\n')

  for (const user of players) {
    await safeSend(bot, user.telegram_id, message)
  }
}

export async function sendMesaFijaRequestNotification(
  admins: User[],
  request: MesaFijaRequest,
  game: Game | null
): Promise<void> {
  const bot = getBot()
  if (!bot) return

  const gameName = game?.name ?? 'Juego desconocido'
  const message = [
    `📋 <b>Nueva solicitud de mesa fija</b>`,
    ``,
    `🎲 Juego: <b>${gameName}</b>`,
    request.reason ? `💬 Motivo: ${request.reason}` : '',
    ``,
    `Revisa la solicitud en la app del club para aprobarla o rechazarla.`,
  ].filter(Boolean).join('\n')

  for (const admin of admins) {
    await safeSend(bot, admin.telegram_id, message)
  }
}

export async function sendMesaFijaApprovedNotification(
  requester: Pick<User, 'telegram_id' | 'display_name'>,
  request: MesaFijaRequest,
  game: Game | null
): Promise<void> {
  const bot = getBot()
  if (!bot) return

  const gameName = game?.name ?? 'tu juego'
  const message = [
    `✅ <b>¡Solicitud aprobada! ${gameName}</b>`,
    ``,
    `Tu solicitud ha sido aprobada por la junta y ya está en la cola de la mesa.`,
    `Podrás registrar la partida cuando tu solicitud llegue a la primera posición y la mesa quede libre.`,
    request.admin_notes ? `💬 Nota de la junta: ${request.admin_notes}` : '',
  ].filter(Boolean).join('\n')

  await safeSend(bot, requester.telegram_id, message)
}

export async function sendMesaFijaRejectedNotification(
  requester: Pick<User, 'telegram_id' | 'display_name'>,
  request: MesaFijaRequest,
  game: Game | null,
  adminNotes: string | null
): Promise<void> {
  const bot = getBot()
  if (!bot) return

  const gameName = game?.name ?? 'tu juego'
  const message = [
    `❌ <b>Solicitud rechazada: ${gameName}</b>`,
    ``,
    `Tu solicitud de mesa fija no ha sido aprobada por la junta.`,
    adminNotes ? `💬 Motivo: ${adminNotes}` : '',
    ``,
    `Puedes volver a solicitar la mesa en otro momento desde la app.`,
  ].filter(Boolean).join('\n')

  await safeSend(bot, requester.telegram_id, message)
}

export async function sendMesaFijaYourTurnNotification(
  requester: Pick<User, 'telegram_id' | 'display_name'>,
  request: MesaFijaRequest,
  game: Game | null
): Promise<void> {
  const bot = getBot()
  if (!bot) return

  const gameName = game?.name ?? 'tu juego'
  const message = [
    `🎉 <b>¡Es tu turno! Mesa fija para ${gameName}</b>`,
    ``,
    `Una mesa fija se ha liberado y tu solicitud está primera en la cola.`,
    `Ya puedes registrar tu partida directamente desde la app del club.`,
  ].join('\n')

  await safeSend(bot, requester.telegram_id, message)
}

export async function sendMesaFijaExpiredNotification(
  requester: Pick<User, 'telegram_id' | 'display_name'>,
  request: MesaFijaRequest,
  game: Game | null
): Promise<void> {
  const bot = getBot()
  if (!bot) return

  const gameName = game?.name ?? 'tu juego'
  const message = [
    `ℹ️ <b>Actualización de tu solicitud: ${gameName}</b>`,
    ``,
    `Tu aprobación anterior ya no está activa.`,
    `Si sigues interesado, puedes volver a solicitar la mesa desde la app del club.`,
  ].join('\n')

  await safeSend(bot, requester.telegram_id, message)
}

export async function sendReminderNotification(
  user: User,
  session: Session,
  game: Game | null
): Promise<void> {
  const bot = getBot()
  if (!bot) return

  const gameName = game?.name ?? 'tu partida'
  const message = [
    `⏰ <b>Recordatorio: ${gameName} mañana</b>`,
    ``,
    `📅 ${formatDate(session.scheduled_date)}${formatTime(session.scheduled_time_start)}`,
    `📍 ${session.location_type === 'club' ? 'Club Dragón' : session.location_type}`,
  ].join('\n')

  await safeSend(bot, user.telegram_id, message)
}
