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
  avatar_url?: string | null
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
  expected_duration_months: number | null
  requester: Requester | null
  game: Game | null
  slot: Slot | null
}

function formatMesaName(slot: Slot | null): string {
  if (!slot) return 'Mesa sin asignar'
  return slot.label?.trim() || `Mesa ${slot.slot_number}`
}

export default function AdminMesasFijasPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [activeTab, setActiveTab] = useState<'pending' | 'queued'>('pending')
  const [reviewError, setReviewError] = useState<string | null>(null)

  const { data: me } = useQuery<{ id: string; is_admin: boolean }>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/users/me').then((r) => r.json()),
  })

  useEffect(() => {
    if (me && !me.is_admin) router.replace('/tableros')
  }, [me, router])

  const { data: pendingRequests = [], isLoading: loadingPending } = useQuery<MesaFijaRequest[]>({
    queryKey: ['admin-mfr-pending'],
    queryFn: () => fetch('/api/storage/mesa-fija-requests?status=pending').then((r) => r.json()),
    enabled: !!me?.is_admin,
  })

  const { data: queuedRequests = [], isLoading: loadingQueued } = useQuery<MesaFijaRequest[]>({
    queryKey: ['admin-mfr-queued'],
    queryFn: () => fetch('/api/storage/mesa-fija-requests?status=queued').then((r) => r.json()),
    enabled: !!me?.is_admin,
  })

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: 'queued' | 'rejected'; notes: string }) => {
      const res = await fetch(`/api/storage/mesa-fija-requests/${id}`, {
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
      qc.invalidateQueries({ queryKey: ['admin-mfr-pending'] })
      qc.invalidateQueries({ queryKey: ['admin-mfr-queued'] })
      setReviewingId(null)
      setAdminNotes('')
      setReviewError(null)
    },
    onError: (e: Error) => {
      setReviewError(e.message)
    },
  })

  const deleteQueuedMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/storage/mesa-fija-requests/${id}/cancel`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? 'No se pudo eliminar la solicitud en cola')
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-mfr-pending'] })
      qc.invalidateQueries({ queryKey: ['admin-mfr-queued'] })
    },
    onError: (e: Error) => {
      setReviewError(e.message)
    },
  })

  if (!me) return <div className="p-4"><div className="h-48 bg-slate-900 rounded-xl animate-pulse" /></div>
  if (!me.is_admin) return null

  const isLoading = loadingPending || loadingQueued

  function startReview(id: string) {
    setReviewingId(id)
    setAdminNotes('')
    setReviewError(null)
  }

  function submitReview(status: 'queued' | 'rejected') {
    if (!reviewingId) return
    reviewMutation.mutate({ id: reviewingId, status, notes: adminNotes })
  }

  function deleteQueuedRequest(id: string) {
    const ok = window.confirm('¿Eliminar esta solicitud de la cola?')
    if (!ok) return
    setReviewError(null)
    deleteQueuedMutation.mutate(id)
  }

  const queuedBySlot = new Map<string, { slot: Slot | null; requests: MesaFijaRequest[] }>()
  for (const req of queuedRequests) {
    const key = req.slot?.id ?? 'unassigned'
    if (!queuedBySlot.has(key)) {
      queuedBySlot.set(key, { slot: req.slot ?? null, requests: [] })
    }
    queuedBySlot.get(key)!.requests.push(req)
  }
  const queuedGroups = Array.from(queuedBySlot.values()).sort((a, b) => {
    if (!a.slot && !b.slot) return 0
    if (!a.slot) return 1
    if (!b.slot) return -1
    return a.slot.slot_number - b.slot.slot_number
  })

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <Link href="/admin" className="flex items-center gap-1 text-slate-400 text-sm hover:text-slate-200">
        <ArrowLeft size={16} /> Admin
      </Link>

      <h1 className="text-2xl font-bold text-white">Admin · Mesas Fijas</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('pending')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'pending' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Pendientes ({pendingRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('queued')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'queued' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          En cola ({queuedRequests.length})
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-20 bg-slate-900 rounded-xl animate-pulse" />)}
        </div>
      ) : activeTab === 'pending' ? (
        pendingRequests.length === 0 ? (
          <div className="bg-slate-900 rounded-xl p-6 text-center border border-slate-800">
            <p className="text-slate-400 text-sm">No hay solicitudes pendientes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <div key={req.id} className="bg-slate-900 rounded-xl border border-slate-800 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {req.requester?.avatar_url ? (
                        <img
                          src={req.requester.avatar_url}
                          alt={req.requester.display_name}
                          className="w-6 h-6 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-indigo-800 flex items-center justify-center text-[10px] font-bold text-white">
                          {req.requester?.display_name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <p className="text-sm font-medium text-white">
                        {req.requester?.display_name ?? '—'}
                        {req.requester?.telegram_username && (
                          <span className="ml-2 text-xs text-slate-500">@{req.requester.telegram_username}</span>
                        )}
                      </p>
                    </div>
                    <p className="text-sm text-slate-300 mt-0.5">{req.game?.name ?? '—'}</p>
                    {req.slot && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatMesaName(req.slot)}
                      </p>
                    )}
                    {req.reason && (
                      <p className="text-xs text-slate-400 mt-1 italic">"{req.reason}"</p>
                    )}
                    {req.expected_duration_months && (
                      <p className="text-xs text-slate-500 mt-1">Estimación: {req.expected_duration_months} mes(es)</p>
                    )}
                    <p className="text-xs text-slate-600 mt-1">{new Date(req.requested_at).toLocaleDateString('es-ES')}</p>
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
                        onClick={() => submitReview('queued')}
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
        queuedRequests.length === 0 ? (
          <div className="bg-slate-900 rounded-xl p-6 text-center border border-slate-800">
            <p className="text-slate-400 text-sm">No hay solicitudes en cola</p>
          </div>
        ) : (
          <div className="space-y-4">
            {queuedGroups.map((group) => (
              <div key={group.slot?.id ?? 'unassigned'} className="bg-slate-900 rounded-xl border border-slate-800 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-200">{formatMesaName(group.slot)}</h2>
                  <span className="text-xs text-indigo-300 bg-indigo-950 border border-indigo-800 rounded-full px-2 py-0.5">
                    {group.requests.length} en cola
                  </span>
                </div>
                <div className="space-y-2">
                  {group.requests.map((req) => (
                    <div key={req.id} className="bg-green-950 rounded-lg border border-green-800 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {req.requester?.avatar_url ? (
                              <img
                                src={req.requester.avatar_url}
                                alt={req.requester.display_name}
                                className="w-6 h-6 rounded-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-indigo-800 flex items-center justify-center text-[10px] font-bold text-white">
                                {req.requester?.display_name?.[0]?.toUpperCase() ?? '?'}
                              </div>
                            )}
                            <p className="text-sm font-medium text-white">
                              {req.requester?.display_name ?? '—'}
                            </p>
                          </div>
                          <p className="text-sm text-slate-300">{req.game?.name ?? '—'}</p>
                          {req.expected_duration_months && (
                            <p className="text-xs text-slate-400 mt-0.5">Estimación: {req.expected_duration_months} mes(es)</p>
                          )}
                          <p className="text-xs text-green-400 mt-1">#{req.queue_position} en cola</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-green-400 text-xs font-medium">En cola</span>
                          <button
                            onClick={() => deleteQueuedRequest(req.id)}
                            disabled={deleteQueuedMutation.isPending}
                            className="text-xs text-red-300 hover:text-red-200 disabled:opacity-50"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
