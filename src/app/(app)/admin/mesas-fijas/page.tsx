'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Check, X } from 'lucide-react'

interface Requester {
  id: string
  display_name: string
  telegram_username: string | null
}

interface Game {
  id: string
  name: string
  category: string | null
}

interface Slot {
  id: string
  slot_number: number
  label: string | null
}

interface MesaFijaRequest {
  id: string
  slot_id: string | null
  status: string
  queue_position: number
  reason: string | null
  admin_notes: string | null
  requested_at: string
  expires_at: string | null
  requester: Requester | null
  game: Game | null
  slot: Slot | null
}

export default function AdminMesasFijasPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [activeTab, setActiveTab] = useState<'queued' | 'approved'>('queued')
  const [reviewError, setReviewError] = useState<string | null>(null)

  const { data: me } = useQuery<{ id: string; is_admin: boolean }>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/users/me').then((r) => r.json()),
  })

  useEffect(() => {
    if (me && !me.is_admin) router.replace('/tableros')
  }, [me, router])

  const { data: queuedRequests = [], isLoading: loadingQueued } = useQuery<MesaFijaRequest[]>({
    queryKey: ['admin-mfr-queued'],
    queryFn: () => fetch('/api/storage/mesa-fija-requests?status=queued').then((r) => r.json()),
    enabled: !!me?.is_admin,
  })

  const { data: approvedRequests = [], isLoading: loadingApproved } = useQuery<MesaFijaRequest[]>({
    queryKey: ['admin-mfr-approved'],
    queryFn: () => fetch('/api/storage/mesa-fija-requests?status=approved').then((r) => r.json()),
    enabled: !!me?.is_admin,
  })

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: 'approved' | 'rejected'; notes: string }) => {
      const res = await fetch(`/api/storage/mesa-fija-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_notes: notes || undefined }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string; code?: string }
        throw new Error(body.code === 'ALREADY_APPROVED'
          ? 'Ya hay una solicitud aprobada para esta mesa. Rechaza o espera a que expire primero.'
          : (body.error ?? 'Error al procesar la solicitud'))
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-mfr-queued'] })
      qc.invalidateQueries({ queryKey: ['admin-mfr-approved'] })
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

  const isLoading = loadingQueued || loadingApproved

  function startReview(id: string) {
    setReviewingId(id)
    setAdminNotes('')
    setReviewError(null)
  }

  function submitReview(status: 'approved' | 'rejected') {
    if (!reviewingId) return
    reviewMutation.mutate({ id: reviewingId, status, notes: adminNotes })
  }

  function hoursLeft(expiresAt: string): number {
    return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)))
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <Link href="/admin" className="flex items-center gap-1 text-slate-400 text-sm hover:text-slate-200">
        <ArrowLeft size={16} /> Admin
      </Link>

      <h1 className="text-2xl font-bold text-white">Admin · Mesas Fijas</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('queued')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'queued' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Pendientes ({queuedRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'approved' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Aprobadas ({approvedRequests.length})
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-900 rounded-xl animate-pulse" />)}
        </div>
      ) : activeTab === 'queued' ? (
        queuedRequests.length === 0 ? (
          <div className="bg-slate-900 rounded-xl p-6 text-center border border-slate-800">
            <p className="text-slate-400 text-sm">No hay solicitudes pendientes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {queuedRequests.map((req) => (
              <div key={req.id} className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">
                      {req.requester?.display_name ?? '—'}
                      {req.requester?.telegram_username && (
                        <span className="ml-2 text-xs text-slate-500">@{req.requester.telegram_username}</span>
                      )}
                    </p>
                    <p className="text-sm text-slate-300 mt-0.5">{req.game?.name ?? '—'}</p>
                    {req.slot && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Mesa {req.slot.slot_number}{req.slot.label ? ` · ${req.slot.label}` : ''}
                      </p>
                    )}
                    {req.reason && (
                      <p className="text-xs text-slate-400 mt-1 italic">"{req.reason}"</p>
                    )}
                    <p className="text-xs text-slate-600 mt-1">
                      #{req.queue_position} en cola · {new Date(req.requested_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>

                {reviewingId === req.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      placeholder="Nota para el socio (opcional)..."
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                    />
                    {reviewError && reviewingId === req.id && (
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
                    onClick={() => startReview(req.id)}
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
        approvedRequests.length === 0 ? (
          <div className="bg-slate-900 rounded-xl p-6 text-center border border-slate-800">
            <p className="text-slate-400 text-sm">No hay solicitudes aprobadas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {approvedRequests.map((req) => (
              <div key={req.id} className="bg-green-950 rounded-xl border border-green-800 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">
                      {req.requester?.display_name ?? '—'}
                    </p>
                    <p className="text-sm text-slate-300">{req.game?.name ?? '—'}</p>
                    {req.slot && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Mesa {req.slot.slot_number}{req.slot.label ? ` · ${req.slot.label}` : ''}
                      </p>
                    )}
                    {req.expires_at && (
                      <p className={`text-xs mt-1 ${hoursLeft(req.expires_at) < 6 ? 'text-red-400' : 'text-green-400'}`}>
                        ⏳ Expira en {hoursLeft(req.expires_at)}h
                      </p>
                    )}
                  </div>
                  <span className="text-green-400 text-xs font-medium shrink-0">Aprobada</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
