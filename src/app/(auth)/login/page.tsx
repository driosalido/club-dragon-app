import TelegramLoginButton from '@/components/TelegramLoginButton'

export default function LoginPage() {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? 'ClubDragonBot'

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="bg-slate-900 rounded-2xl p-10 flex flex-col items-center gap-6 shadow-xl border border-slate-800 max-w-sm w-full mx-4">
        <div className="flex flex-col items-center gap-2">
          <span className="text-5xl">🐉</span>
          <h1 className="text-2xl font-bold text-white tracking-tight">Club Dragón Madrid</h1>
          <p className="text-slate-400 text-sm text-center">
            Accede con tu cuenta de Telegram para gestionar partidas y tableros almacenados.
          </p>
        </div>

        <TelegramLoginButton botUsername={botUsername} />

        <p className="text-xs text-slate-600 text-center">
          Solo para socios del Club Dragón Madrid
        </p>
      </div>
    </main>
  )
}
