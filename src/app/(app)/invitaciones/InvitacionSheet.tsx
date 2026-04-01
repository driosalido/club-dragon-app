'use client'

import { useState } from 'react'
import { X, Ticket } from 'lucide-react'

interface InvitationStats {
  remaining_free: number
  next_is_paid: boolean
  cost_euros: number
  free_limit: number
}

interface Props {
  stats: InvitationStats | null
  onClose: () => void
  onCreated: () => void
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function InvitacionSheet({ stats, onClose, onCreated }: Props) {
  const [guestName, setGuestName] = useState('')
  const [visitDate, setVisitDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const today = getTodayString()

  // Preview cost: if stats says next is paid, this invitation will be paid
  const willBePaid = stats?.next_is_paid ?? false

  async function handleSubmit() {
    if (!guestName.trim() || !visitDate) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guest_name: guestName.trim(), visit_date: visitDate }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string; code?: string }
        if (data.code === 'DUPLICATE_INVITATION') {
          setError('Ya tienes una invitación activa para este invitado en esa fecha.')
        } else if (data.code === 'INVALID_DATE') {
          setError('La fecha de visita debe ser hoy o en el futuro.')
        } else {
          setError(data.error ?? 'Error al enviar la solicitud')
        }
        return
      }
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 rounded-t-2xl border-t border-slate-700 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Invitar a alguien al club</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {submitted ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-4">🎫</div>
            <h3 className="text-lg font-semibold text-white mb-2">¡Solicitud enviada!</h3>
            <p className="text-slate-400 text-sm mb-2">
              Tu invitación está <span className="text-amber-300 font-medium">pendiente de aprobación</span> por la junta.
            </p>
            <p className="text-slate-500 text-xs mb-6">
              Recibirás una notificación por Telegram cuando sea revisada.
            </p>
            {willBePaid && (
              <div className="bg-amber-950/60 border border-amber-800 rounded-xl p-3 mb-6 text-xs text-amber-300 text-left">
                <p className="font-medium mb-1">💶 Recordatorio de pago</p>
                <p>Esta invitación tiene un coste de <strong>{stats?.cost_euros ?? 5}€</strong>. Si es aprobada, deberás entregárselos a un miembro de la junta.</p>
              </div>
            )}
            <button
              onClick={onCreated}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-medium"
            >
              Entendido
            </button>
          </div>
        ) : (
          <>
            {/* Cost preview */}
            <div className={`rounded-xl p-3 mb-6 flex items-start gap-3 ${
              willBePaid
                ? 'bg-amber-950/60 border border-amber-800'
                : 'bg-green-950/60 border border-green-800'
            }`}>
              <Ticket size={18} className={willBePaid ? 'text-amber-400 mt-0.5 shrink-0' : 'text-green-400 mt-0.5 shrink-0'} />
              <div>
                {willBePaid ? (
                  <>
                    <p className="text-sm font-medium text-amber-300">Invitación de pago</p>
                    <p className="text-xs text-amber-400/80 mt-0.5">
                      Has agotado tus {stats?.free_limit ?? 2} invitaciones gratuitas de este año. Esta tendrá un coste de <strong>{stats?.cost_euros ?? 5}€</strong>.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-green-300">Invitación gratuita</p>
                    <p className="text-xs text-green-400/80 mt-0.5">
                      Te {(stats?.remaining_free ?? 0) === 1 ? 'queda' : 'quedan'} <strong>{stats?.remaining_free ?? '—'}</strong> invitación{(stats?.remaining_free ?? 0) !== 1 ? 'es' : ''} gratuita{(stats?.remaining_free ?? 0) !== 1 ? 's' : ''} este año.
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">
                Nombre y apellidos del invitado
              </label>
              <input
                type="text"
                placeholder="Ej. María García López"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                maxLength={200}
                autoComplete="off"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-2">
                Fecha de visita
              </label>
              <input
                type="date"
                min={today}
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center bg-red-950/40 border border-red-900 rounded-lg px-4 py-2 mb-4">
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!guestName.trim() || !visitDate || submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-3 font-medium transition-colors"
            >
              {submitting ? 'Enviando...' : 'Solicitar invitación'}
            </button>

            <p className="text-xs text-slate-600 text-center mt-3">
              La junta aprobará o rechazará tu solicitud. Recibirás una notificación por Telegram.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
