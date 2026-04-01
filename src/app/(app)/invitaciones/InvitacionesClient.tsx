'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Ticket } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import InvitacionSheet from './InvitacionSheet'

interface InvitationStats {
  year: number
  total_approved: number
  used_free: number
  remaining_free: number
  pending_count: number
  next_is_paid: boolean
  cost_euros: number
  free_limit: number
}

interface GuestInvitation {
  id: string
  inviter_id: string
  guest_name: string
  visit_date: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'used'
  is_paid: boolean
  admin_notes: string | null
  created_at: string
}

const STATUS_LABELS: Record<GuestInvitation['status'], string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
  used: 'Usada',
}

const STATUS_COLORS: Record<GuestInvitation['status'], string> = {
  pending: 'bg-amber-950 border-amber-800 text-amber-300',
  approved: 'bg-green-950 border-green-800 text-green-300',
  rejected: 'bg-red-950 border-red-800 text-red-300',
  cancelled: 'bg-slate-800 border-slate-700 text-slate-400',
  used: 'bg-indigo-950 border-indigo-800 text-indigo-300',
}

function formatVisitDate(date: string): string {
  return format(parseISO(date), "d 'de' MMMM yyyy", { locale: es })
}

export default function InvitacionesClient() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const qc = useQueryClient()

  const { data: stats, isLoading: loadingStats } = useQuery<InvitationStats>({
    queryKey: ['invitation-stats'],
    queryFn: () => fetch('/api/invitations/stats').then((r) => r.json()),
  })

  const { data: invitations = [], isLoading: loadingList } = useQuery<GuestInvitation[]>({
    queryKey: ['invitations-mine'],
    queryFn: () => fetch('/api/invitations?mine=true').then((r) => r.json()),
  })

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/invitations/${id}/cancel`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? 'Error al cancelar')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invitations-mine'] })
      qc.invalidateQueries({ queryKey: ['invitation-stats'] })
    },
  })

  function handleCreated() {
    setSheetOpen(false)
    qc.invalidateQueries({ queryKey: ['invitations-mine'] })
    qc.invalidateQueries({ queryKey: ['invitation-stats'] })
  }

  function handleCancel(id: string) {
    if (!window.confirm('¿Cancelar esta invitación?')) return
    cancelMutation.mutate(id)
  }

  const currentYear = new Date().getFullYear()

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-white">Invitaciones</h1>

      {/* Stats card */}
      {loadingStats ? (
        <div className="h-28 bg-slate-900 rounded-xl animate-pulse" />
      ) : stats ? (
        <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ticket size={18} className="text-indigo-400" />
              <p className="text-sm font-medium text-white">Invitaciones {stats.year}</p>
            </div>
            {stats.next_is_paid && (
              <span className="text-xs bg-amber-950 border border-amber-800 text-amber-300 rounded-full px-2 py-0.5">
                Próxima: {stats.cost_euros}€
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-slate-400">
                {stats.used_free} de {stats.free_limit} invitaciones gratuitas usadas
              </span>
              {stats.remaining_free > 0 ? (
                <span className="text-green-400">{stats.remaining_free} disponible{stats.remaining_free !== 1 ? 's' : ''}</span>
              ) : (
                <span className="text-amber-400">Sin gratuitas</span>
              )}
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  stats.used_free === 0
                    ? 'bg-green-600'
                    : stats.used_free < stats.free_limit
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, (stats.used_free / stats.free_limit) * 100)}%` }}
              />
            </div>
          </div>

          {stats.pending_count > 0 && (
            <p className="text-xs text-amber-400">
              {stats.pending_count} invitación{stats.pending_count !== 1 ? 'es' : ''} pendiente{stats.pending_count !== 1 ? 's' : ''} de aprobación
            </p>
          )}

          {stats.next_is_paid && (
            <p className="text-xs text-slate-500">
              Has usado tus {stats.free_limit} invitaciones gratuitas de {currentYear}. Las siguientes tendrán un coste de {stats.cost_euros}€ que deberás entregar a un miembro de la junta.
            </p>
          )}
        </div>
      ) : null}

      {/* Invitations list */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-slate-400">Mis invitaciones</h2>

        {loadingList ? (
          <div className="space-y-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-20 bg-slate-900 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : invitations.length === 0 ? (
          <div className="bg-slate-900 rounded-xl p-6 text-center border border-slate-800">
            <p className="text-slate-500 text-sm">No tienes invitaciones todavía</p>
            <p className="text-slate-600 text-xs mt-1">Pulsa el botón + para invitar a alguien</p>
          </div>
        ) : (
          invitations.map((inv) => (
            <div
              key={inv.id}
              className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{inv.guest_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    📅 {formatVisitDate(inv.visit_date)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className={`text-xs border rounded-full px-2 py-0.5 ${STATUS_COLORS[inv.status]}`}>
                    {STATUS_LABELS[inv.status]}
                  </span>
                  <span className={`text-xs font-medium ${inv.is_paid ? 'text-amber-400' : 'text-green-400'}`}>
                    {inv.is_paid ? '5€' : 'GRATIS'}
                  </span>
                </div>
              </div>

              {inv.admin_notes && inv.status === 'rejected' && (
                <p className="text-xs text-slate-500 italic">"{inv.admin_notes}"</p>
              )}

              {['pending', 'approved'].includes(inv.status) && (
                <button
                  onClick={() => handleCancel(inv.id)}
                  disabled={cancelMutation.isPending}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  Cancelar invitación
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-24 right-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full p-4 shadow-lg z-10"
        aria-label="Nueva invitación"
      >
        <Plus size={24} />
      </button>

      {sheetOpen && (
        <InvitacionSheet
          stats={stats ?? null}
          onClose={() => setSheetOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
