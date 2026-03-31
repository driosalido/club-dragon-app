'use client'

import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
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
        .then((r) => r.json()),
    enabled: !!slotId,
  })

  const { data: myRequest } = useQuery<MesaFijaRequest | null>({
    queryKey: ['my-mesa-fija-request', slotId],
    queryFn: async () => {
      const res = await fetch(`/api/storage/mesa-fija-requests?slot_id=${slotId}&mine=true`)
      const data = await res.json() as MesaFijaRequest[]
      return data.find((r) => ['queued', 'approved'].includes(r.status)) ?? null
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

  const slotName = slot ? `Mesa ${slot.slot_number}${slot.label ? ` · ${slot.label}` : ''}` : 'Mesa'

  const approvedSlot = slot && myRequest?.status === 'approved' ? [slot] : []

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <Link href="/tableros" className="flex items-center gap-1 text-slate-400 text-sm hover:text-slate-200">
        <ArrowLeft size={16} /> Almacén
      </Link>

      <h1 className="text-2xl font-bold text-white">{slotName}</h1>
      <p className="text-slate-400 text-sm">Cola de solicitudes</p>

      {/* My request banner */}
      {myRequest && (
        <div className={`rounded-xl p-4 border ${
          myRequest.status === 'approved'
            ? 'bg-green-950 border-green-800'
            : 'bg-indigo-950 border-indigo-800'
        }`}>
          {myRequest.status === 'approved' ? (
            <>
              <p className="text-green-300 font-medium text-sm mb-1">✅ Tu solicitud ha sido aprobada</p>
              <p className="text-green-400 text-xs mb-3">
                {myRequest.expires_at
                  ? `Expira: ${new Date(myRequest.expires_at).toLocaleString('es-ES')}`
                  : ''}
              </p>
              <button
                onClick={() => setClaimSheetOpen(true)}
                className="w-full bg-green-700 hover:bg-green-600 text-white rounded-lg py-2 text-sm font-medium"
              >
                Reclamar mesa
              </button>
            </>
          ) : (
            <>
              <p className="text-indigo-300 font-medium text-sm mb-1">
                Estás en posición #{myRequest.queue_position} de la cola
              </p>
              <p className="text-indigo-400 text-xs mb-3">
                Juego: {myRequest.game?.name ?? '—'}
              </p>
              <button
                onClick={() => cancelMutation.mutate(myRequest.id)}
                disabled={cancelMutation.isPending}
                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
              >
                Cancelar solicitud
              </button>
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
                {req.reason && (
                  <p className="text-xs text-slate-600 truncate mt-0.5">{req.reason}</p>
                )}
              </div>
              <p className="text-xs text-slate-600 shrink-0">
                {new Date(req.requested_at).toLocaleDateString('es-ES')}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Claim sheet for approved requests */}
      {claimSheetOpen && approvedSlot.length > 0 && (
        <NuevoTableroSheet
          slots={approvedSlot}
          preselectedSlot={approvedSlot[0]!}
          preselectedGame={myRequest?.game ?? null}
          onClose={() => setClaimSheetOpen(false)}
          onCreated={() => {
            setClaimSheetOpen(false)
            qc.invalidateQueries({ queryKey: ['slots'] })
            qc.invalidateQueries({ queryKey: ['my-mesa-fija-request', slotId] })
          }}
        />
      )}
    </div>
  )
}
