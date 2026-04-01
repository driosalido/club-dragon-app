'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

interface Inviter {
  id: string
  display_name: string
  telegram_username: string | null
  avatar_url?: string | null
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
  inviter: Inviter | null
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

export default function AdminInvitacionesPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [reviewError, setReviewError] = useState<string | null>(null)

  const { data: me } = useQuery<{ id: string; is_admin: boolean }>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/users/me').then((r) => r.json()),
  })

  useEffect(() => {
    if (me && !me.is_admin) router.replace('/tableros')
  }, [me, router])

  const { data: pendingInvitations = [], isLoading: loadingPending } = useQuery<GuestInvitation[]>({
    queryKey: ['admin-invitations-pending'],
    queryFn: () => fetch('/api/invitations?status=pending').then((r) => r.json()),
    enabled: !!me?.is_admin,
  })

  const { data: allInvitations = [], isLoading: loadingAll } = useQuery<GuestInvitation[]>({
    queryKey: ['admin-invitations-all'],
    queryFn: () => fetch('/api/invitations').then((r) => r.json()),
    enabled: !!me?.is_admin && activeTab === 'history',
  })

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: 'approved' | 'rejected'; notes: string }) => {
      const res = await fetch(`/api/invitations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_notes: notes || undefined }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string; code?: string }
        throw new Error(body.error ?? 'Error al procesar la solicitud')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-invitations-pending'] })
      qc.invalidateQueries({ queryKey: ['admin-invitations-all'] })
      setReviewingId(null)
      setAdminNotes('')
      setReviewError(null)
    },
    onError: (e: Error) => {
      setReviewError(e.message)
    },
  })

  if (!me) return <div className="p-4"><div className="h-48 bg-slate-900 rounded-xl animate-pulse" /></div>
  if (!me.is_admin) return null

  function startReview(id: string) {
    setReviewingId(id)
    setAdminNotes('')
    setReviewError(null)
  }

  function submitReview(status: 'approved' | 'rejected') {
    if (!reviewingId) return
    reviewMutation.mutate({ id: reviewingId, status, notes: adminNotes })
  }

  const historyItems = allInvitations.filter((i) => i.status !== 'pending')

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <Link href="/admin" className="flex items-center gap-1 text-slate-400 text-sm hover:text-slate-200">
        <ArrowLeft size={16} /> Admin
      </Link>

      <h1 className="text-2xl font-bold text-white">Admin · Invitaciones</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'pending' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Pendientes ({pendingInvitations.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'history' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Historial
        </button>
      </div>

      {activeTab === 'pending' ? (
        loadingPending ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-900 rounded-xl animate-pulse" />)}
          </div>
        ) : pendingInvitations.length === 0 ? (
          <div className="bg-slate-900 rounded-xl p-6 text-center border border-slate-800">
            <p className="text-slate-400 text-sm">No hay invitaciones pendientes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingInvitations.map((inv) => (
              <div key={inv.id} className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {/* Inviter */}
                    <div className="flex items-center gap-2 mb-1">
                      {inv.inviter?.avatar_url ? (
                        <img
                          src={inv.inviter.avatar_url}
                          alt={inv.inviter.display_name}
                          className="w-6 h-6 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-indigo-800 flex items-center justify-center text-[10px] font-bold text-white">
                          {inv.inviter?.display_name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <p className="text-sm font-medium text-white">
                        {inv.inviter?.display_name ?? '—'}
                        {inv.inviter?.telegram_username && (
                          <span className="ml-2 text-xs text-slate-500">@{inv.inviter.telegram_username}</span>
                        )}
                      </p>
                    </div>
                    {/* Guest */}
                    <p className="text-sm text-slate-300">
                      Invita a: <span className="font-medium text-white">{inv.guest_name}</span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">📅 {formatVisitDate(inv.visit_date)}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Solicitada el {format(parseISO(inv.created_at), 'd MMM yyyy', { locale: es })}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${
                    inv.is_paid ? 'bg-amber-950 border-amber-800 text-amber-300' : 'bg-green-950 border-green-800 text-green-300'
                  }`}>
                    {inv.is_paid ? '5€' : 'GRATIS'}
                  </span>
                </div>

                {reviewingId === inv.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      placeholder="Nota para el socio (opcional)..."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                    />
                    {reviewError && reviewingId === inv.id && (
                      <p className="text-red-400 text-xs bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
                        {reviewError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => submitReview('approved')}
                        disabled={reviewMutation.isPending}
                        className="flex items-center gap-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium"
                      >
                        <Check size={14} /> Aprobar
                      </button>
                      <button
                        onClick={() => submitReview('rejected')}
                        disabled={reviewMutation.isPending}
                        className="flex items-center gap-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg px-4 py-2 text-sm font-medium"
                      >
                        <X size={14} /> Rechazar
                      </button>
                      <button
                        onClick={() => { setReviewingId(null); setReviewError(null) }}
                        className="text-slate-500 hover:text-slate-300 text-sm px-2"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => startReview(inv.id)}
                    className="text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    Revisar solicitud →
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        loadingAll ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-900 rounded-xl animate-pulse" />)}
          </div>
        ) : historyItems.length === 0 ? (
          <div className="bg-slate-900 rounded-xl p-6 text-center border border-slate-800">
            <p className="text-slate-400 text-sm">No hay invitaciones en el historial</p>
          </div>
        ) : (
          <div className="space-y-2">
            {historyItems.map((inv) => (
              <div key={inv.id} className="bg-slate-900 rounded-xl border border-slate-800 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{inv.guest_name}</p>
                    <p className="text-xs text-slate-400">
                      {inv.inviter?.display_name ?? '—'} · {formatVisitDate(inv.visit_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium ${inv.is_paid ? 'text-amber-400' : 'text-green-400'}`}>
                      {inv.is_paid ? '5€' : 'GRATIS'}
                    </span>
                    <span className={`text-xs border rounded-full px-2 py-0.5 ${STATUS_COLORS[inv.status]}`}>
                      {STATUS_LABELS[inv.status]}
                    </span>
                  </div>
                </div>
                {inv.admin_notes && (
                  <p className="text-xs text-slate-500 mt-1 italic">"{inv.admin_notes}"</p>
                )}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
