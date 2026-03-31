'use client'

import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useRef, useState } from 'react'
import NuevoTableroSheet from '../../NuevoTableroSheet'

interface Requester {
  id: string
  display_name: string
  avatar_url: string | null
}

interface Game {
  id: string
  name: string
  category: string | null
}

interface MesaFijaRequest {
  id: string
  slot_id: string | null
  requester_id: string
  status: string
  queue_position: number
  reason: string | null
  requested_at: string
  expires_at: string | null
  expected_duration_months: number | null
  requester: Requester | null
  game: Game | null
}

interface SlotData {
  id: string
  slot_number: number
  label: string | null
  is_active: boolean
  slot_type: 'pizzero' | 'mesa_fija'
  queue_count: number
  occupied: boolean
}

interface Me {
  id: string
  is_admin: boolean
}

export default function MesaFijaQueuePage() {
  const params = useParams<{ slotId: string }>()
  const slotId = params.slotId
  const qc = useQueryClient()
  const [claimSheetOpen, setClaimSheetOpen] = useState(false)
  const [editingRequest, setEditingRequest] = useState<MesaFijaRequest | null>(null)
  const [editReason, setEditReason] = useState('')
  const [editExpectedDurationMonths, setEditExpectedDurationMonths] = useState('')
  const [editGameSearch, setEditGameSearch] = useState('')
  const [editGameResults, setEditGameResults] = useState<Game[]>([])
  const [editGameSearching, setEditGameSearching] = useState(false)
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: me } = useQuery<Me>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/users/me').then((r) => r.json()),
  })

  const { data: slots = [] } = useQuery<SlotData[]>({
    queryKey: ['slots'],
    queryFn: () => fetch('/api/storage/slots').then((r) => r.json()),
  })

  const slot = slots.find((s) => s.id === slotId)

  const { data: requests = [], isLoading } = useQuery<MesaFijaRequest[]>({
    queryKey: ['mesa-fija-queue', slotId],
    queryFn: () =>
      fetch(`/api/storage/mesa-fija-requests?slot_id=${slotId}&status=queued`)
        .then((r) => r.json())
        .then((rows: MesaFijaRequest[] | { error?: string }) =>
          Array.isArray(rows) ? rows : []
        ),
    enabled: !!slotId,
  })

  const { data: myRequest } = useQuery<MesaFijaRequest | null>({
    queryKey: ['my-mesa-fija-request', slotId],
    queryFn: async () => {
      const res = await fetch(`/api/storage/mesa-fija-requests?slot_id=${slotId}&mine=true`)
      const data = await res.json() as MesaFijaRequest[]
      return data.find((r) => ['pending', 'queued'].includes(r.status)) ?? null
    },
    enabled: !!slotId && !!me,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/storage/mesa-fija-requests/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mesa-fija-queue', slotId] })
      qc.invalidateQueries({ queryKey: ['my-mesa-fija-request', slotId] })
      qc.invalidateQueries({ queryKey: ['slots'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async (reqId: string) => {
      const res = await fetch(`/api/storage/mesa-fija-requests/${reqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_id: selectedGame?.id,
          reason: editReason.trim() || null,
          expected_duration_months: editExpectedDurationMonths ? Number(editExpectedDurationMonths) : null,
        }),
      })
      if (!res.ok) {
        const body = await res.json() as { error?: string }
        throw new Error(body.error ?? 'No se pudo editar la solicitud')
      }
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mesa-fija-queue', slotId] })
      qc.invalidateQueries({ queryKey: ['my-mesa-fija-request', slotId] })
      qc.invalidateQueries({ queryKey: ['slots'] })
      setEditingRequest(null)
      setEditGameResults([])
    },
  })

  const slotName = slot ? (slot.label?.trim() || `Mesa ${slot.slot_number}`) : 'Mesa'

  const canClaim = !!slot && !slot.occupied && myRequest?.status === 'queued' && myRequest.queue_position === 1
  const claimableSlot = canClaim ? [slot] : []

  function confirmDelete(reqId: string) {
    const ok = window.confirm('¿Seguro que quieres eliminar esta solicitud de mesa fija?')
    if (!ok) return
    cancelMutation.mutate(reqId)
  }

  function canManage(req: MesaFijaRequest): boolean {
    return !!me && (me.is_admin || req.requester_id === me.id)
  }

  function startEdit(req: MesaFijaRequest) {
    setEditingRequest(req)
    setEditReason(req.reason ?? '')
    setEditExpectedDurationMonths(req.expected_duration_months ? String(req.expected_duration_months) : '')
    setSelectedGame(req.game ?? null)
    setEditGameSearch(req.game?.name ?? '')
    setEditGameResults([])
  }

  function handleEditGameInput(q: string) {
    setEditGameSearch(q)
    setSelectedGame(null)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    if (!q.trim()) {
      setEditGameResults([])
      return
    }
    searchDebounce.current = setTimeout(async () => {
      setEditGameSearching(true)
      try {
        const res = await fetch(`/api/games?q=${encodeURIComponent(q)}`)
        if (res.ok) setEditGameResults(await res.json() as Game[])
      } finally {
        setEditGameSearching(false)
      }
    }, 300)
  }

  function selectGame(game: Game) {
    setSelectedGame(game)
    setEditGameSearch(game.name)
    setEditGameResults([])
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <Link href="/tableros?tab=mesas" className="flex items-center gap-1 text-slate-400 text-sm hover:text-slate-200">
        <ArrowLeft size={16} /> Almacén
      </Link>

      <h1 className="text-2xl font-bold text-white">{slotName}</h1>
      <p className="text-slate-400 text-sm">Cola de solicitudes</p>

      {/* My request banner */}
      {myRequest && (
        <div className={`rounded-xl p-4 border ${
          myRequest.status === 'queued' && myRequest.queue_position === 1 && canClaim
            ? 'bg-green-950 border-green-800'
            : myRequest.status === 'queued'
              ? 'bg-indigo-950 border-indigo-800'
              : 'bg-amber-950 border-amber-800'
        }`}>
          {myRequest.status === 'queued' && myRequest.queue_position === 1 && canClaim ? (
            <>
              <p className="text-green-300 font-medium text-sm mb-1">✅ Tu solicitud está en cabeza de cola</p>
              <p className="text-green-400 text-xs mb-3">
                La mesa está libre. Pulsa en "Reclamar mesa" para registrar tu tablero.
              </p>
              <button
                onClick={() => setClaimSheetOpen(true)}
                className="w-full bg-green-700 hover:bg-green-600 text-white rounded-lg py-2 text-sm font-medium"
              >
                Reclamar mesa
              </button>
            </>
          ) : myRequest.status === 'queued' ? (
            <>
              <p className="text-indigo-300 font-medium text-sm mb-1">
                Estás en posición #{myRequest.queue_position} de la cola
              </p>
              <p className="text-indigo-400 text-xs mb-3">
                Juego: {myRequest.game?.name ?? '—'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => startEdit(myRequest)}
                  className="text-xs text-indigo-300 hover:text-indigo-200"
                >
                  Editar
                </button>
                <button
                  onClick={() => confirmDelete(myRequest.id)}
                  disabled={cancelMutation.isPending}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-amber-300 font-medium text-sm mb-1">
                Tu solicitud está pendiente de aprobación
              </p>
              <p className="text-amber-400 text-xs mb-3">
                Juego: {myRequest.game?.name ?? '—'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => startEdit(myRequest)}
                  className="text-xs text-indigo-300 hover:text-indigo-200"
                >
                  Editar
                </button>
                <button
                  onClick={() => confirmDelete(myRequest.id)}
                  disabled={cancelMutation.isPending}
                  className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                >
                  Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Queue list */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-slate-900 rounded-xl p-6 text-center border border-slate-800">
          <p className="text-slate-400 text-sm">No hay solicitudes en cola</p>
        </div>
      ) : (
        <div className="bg-slate-900 rounded-xl border border-slate-800 divide-y divide-slate-800">
          {requests.map((req) => (
            <div key={req.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-7 h-7 rounded-full bg-indigo-800 flex items-center justify-center text-xs font-bold text-white shrink-0">
                {req.queue_position}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {req.requester?.display_name ?? '—'}
                  {req.requester_id === me?.id && (
                    <span className="ml-2 text-xs text-indigo-400">tú</span>
                  )}
                </p>
                <p className="text-xs text-slate-500 truncate">{req.game?.name ?? '—'}</p>
                <p className="text-xs text-indigo-400">En cola</p>
                {req.reason && <p className="text-xs text-slate-600 truncate mt-0.5">{req.reason}</p>}
                {req.expected_duration_months && (
                  <p className="text-xs text-slate-500 mt-0.5">Estimación: {req.expected_duration_months} mes(es)</p>
                )}
                {canManage(req) && (
                  <div className="flex gap-3 mt-1">
                    <button
                      onClick={() => startEdit(req)}
                      className="text-xs text-indigo-300 hover:text-indigo-200"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => confirmDelete(req.id)}
                      disabled={cancelMutation.isPending}
                      className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-600 shrink-0">
                {new Date(req.requested_at).toLocaleDateString('es-ES')}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Claim sheet for first queued request */}
      {claimSheetOpen && claimableSlot.length > 0 && (
        <NuevoTableroSheet
          slots={claimableSlot}
          preselectedSlot={claimableSlot[0]!}
          preselectedGame={myRequest?.game ?? null}
          onClose={() => setClaimSheetOpen(false)}
          onCreated={() => {
            setClaimSheetOpen(false)
            qc.invalidateQueries({ queryKey: ['slots'] })
            qc.invalidateQueries({ queryKey: ['my-mesa-fija-request', slotId] })
          }}
        />
      )}

      {editingRequest && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditingRequest(null)} />
          <div className="relative bg-slate-900 rounded-t-2xl border-t border-slate-700 p-6 max-h-[85vh] overflow-y-auto space-y-4">
            <h2 className="text-lg font-semibold text-white">Editar solicitud</h2>
            <p className="text-xs text-slate-500">Puedes cambiar juego, motivo o estimación de fin.</p>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Juego</label>
              <input
                type="text"
                value={editGameSearch}
                onChange={(e) => handleEditGameInput(e.target.value)}
                placeholder="Buscar juego..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              data-1p-ignore="true"
              data-lpignore="true"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              {editGameSearching && <p className="text-xs text-slate-500 mt-1">Buscando...</p>}
              {editGameResults.length > 0 && (
                <ul className="mt-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-700">
                  {editGameResults.map((g) => (
                    <li key={g.id}>
                      <button
                        onClick={() => selectGame(g)}
                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700"
                      >
                        {g.name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Duración estimada (meses)</label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={24}
                step={1}
                placeholder="Ej. 6"
                value={editExpectedDurationMonths}
                onChange={(e) => setEditExpectedDurationMonths(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-2">Motivo (opcional)</label>
              <textarea
                rows={3}
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                maxLength={1000}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => updateMutation.mutate(editingRequest.id)}
                disabled={!selectedGame || updateMutation.isPending}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl py-3 font-medium"
              >
                {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                onClick={() => setEditingRequest(null)}
                className="px-4 py-3 text-slate-400 hover:text-slate-200"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
