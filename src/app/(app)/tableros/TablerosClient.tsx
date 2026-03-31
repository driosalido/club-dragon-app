'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import NuevoTableroSheet from './NuevoTableroSheet'
import SolicitarMesaFijaSheet from './SolicitarMesaFijaSheet'

interface SlotGame {
  id: string
  name: string
  category: string | null
  thumbnail_url: string | null
}

interface SlotPlayer {
  user_id: string
  faction_or_side: string | null
  users: { id: string; display_name: string; avatar_url: string | null } | null
}

interface StoredGameData {
  id: string
  status: string
  days_since_last: number | null
  game: SlotGame | null
  players: SlotPlayer[]
}

interface MyRequest {
  id: string
  status: 'queued' | 'approved'
  game_id: string | null
  game_name: string | null
  expires_at: string | null
  queue_position: number
}

interface SlotData {
  id: string
  slot_number: number
  label: string | null
  is_active: boolean
  slot_type: 'pizzero' | 'mesa_fija'
  pizzero: 'A' | 'B' | 'C' | null
  queue_count: number
  occupied: boolean
  stored_game: StoredGameData | null
  my_request: MyRequest | null
}

const STATUS_CONFIG: Record<string, { color: string; border: string; dot: string }> = {
  active:   { color: 'bg-green-950',  border: 'border-green-800', dot: '🟢' },
  warning:  { color: 'bg-yellow-950', border: 'border-yellow-700', dot: '🟡' },
  critical: { color: 'bg-red-950',    border: 'border-red-700',   dot: '🔴' },
  expired:  { color: 'bg-red-950',    border: 'border-red-600',   dot: '💀' },
}

function SlotCard({ slot, onFreeClick }: { slot: SlotData; onFreeClick: (s: SlotData) => void }) {
  const sg = slot.stored_game
  const statusCfg = sg ? (STATUS_CONFIG[sg.status] ?? STATUS_CONFIG.active) : null

  if (!slot.is_active) {
    return (
      <div className="bg-slate-900 rounded-xl p-3 border border-slate-800 opacity-40">
        <p className="text-xs text-slate-600">{slot.label}</p>
        <p className="text-xs text-slate-700 mt-1">Inactivo</p>
      </div>
    )
  }

  if (!slot.occupied || !sg) {
    if (slot.slot_type === 'mesa_fija') {
      const mr = slot.my_request

      if (mr?.status === 'approved') {
        return (
          <button
            onClick={() => onFreeClick(slot)}
            className="bg-green-950 rounded-xl p-3 border border-green-700 text-left w-full hover:opacity-90 transition-opacity"
          >
            <p className="text-xs text-slate-400 mb-1">{slot.label}</p>
            <p className="text-xs font-semibold text-green-300 mb-0.5">✅ ¡Aprobada!</p>
            <p className="text-xs text-green-500 truncate">{mr.game_name ?? '—'}</p>
            <p className="text-xs text-green-600 mt-1">Toca para registrar</p>
          </button>
        )
      }

      if (mr?.status === 'queued') {
        return (
          <Link
            href={`/tableros/mesa-fija/${slot.id}`}
            className="bg-indigo-950 rounded-xl p-3 border border-indigo-800 text-left block hover:opacity-90 transition-opacity"
          >
            <p className="text-xs text-slate-400 mb-1">{slot.label}</p>
            <p className="text-xs font-semibold text-indigo-300 mb-0.5">⏳ En cola #{mr.queue_position}</p>
            <p className="text-xs text-indigo-400 truncate">{mr.game_name ?? '—'}</p>
          </Link>
        )
      }

      return (
        <button
          onClick={() => onFreeClick(slot)}
          className="bg-slate-900 hover:bg-slate-800 rounded-xl p-3 border border-slate-800 border-dashed text-left transition-colors"
        >
          <p className="text-xs text-slate-500 mb-1">{slot.label}</p>
          <div className="flex items-center gap-1 text-slate-600 mb-1">
            <Plus size={13} />
            <span className="text-xs">Disponible</span>
          </div>
          {(slot.queue_count ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-indigo-400">
              <Users size={11} />
              <span className="text-xs">{slot.queue_count} en cola</span>
            </div>
          )}
        </button>
      )
    }

    return (
      <button
        onClick={() => onFreeClick(slot)}
        className="bg-slate-900 hover:bg-slate-800 rounded-xl p-3 border border-slate-800 border-dashed text-left transition-colors"
      >
        <p className="text-xs text-slate-500 mb-1">{slot.label}</p>
        <div className="flex items-center gap-1 text-slate-600">
          <Plus size={13} />
          <span className="text-xs">Libre</span>
        </div>
      </button>
    )
  }

  return (
    <Link
      href={`/tableros/${sg.id}`}
      className={`rounded-xl p-3 border transition-colors hover:opacity-90 ${statusCfg!.color} ${statusCfg!.border}`}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-slate-400">{slot.label}</p>
        <span className="text-sm">{statusCfg!.dot}</span>
      </div>
      <p className="text-sm font-medium text-white truncate mb-1">
        {sg.game?.name ?? '—'}
      </p>
      <p className="text-xs text-slate-400">
        {sg.days_since_last !== null ? `${sg.days_since_last}d sin jugar` : ''}
      </p>
      <p className="text-xs text-slate-500 truncate mt-1">
        {sg.players.slice(0, 2).map((p) => p.users?.display_name ?? '?').join(', ')}
        {sg.players.length > 2 ? ` +${sg.players.length - 2}` : ''}
      </p>
    </Link>
  )
}

export default function TablerosClient() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'pizzeros' | 'mesas'>('pizzeros')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [preselectedSlot, setPreselectedSlot] = useState<SlotData | null>(null)
  const [mesaSheetSlot, setMesaSheetSlot] = useState<SlotData | null>(null)
  const [registrarSlot, setRegistrarSlot] = useState<SlotData | null>(null)

  const { data: slots = [], isLoading } = useQuery<SlotData[]>({
    queryKey: ['slots'],
    queryFn: () => fetch('/api/storage/slots').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const pizzeroSlots = slots.filter((s) => s.slot_type === 'pizzero')
  const mesaSlots = slots.filter((s) => s.slot_type === 'mesa_fija' && s.is_active)

  // Group pizzero slots by pizzero letter
  const pizzeroGroups: Record<string, SlotData[]> = { A: [], B: [], C: [] }
  for (const slot of pizzeroSlots) {
    if (slot.pizzero && pizzeroGroups[slot.pizzero]) {
      pizzeroGroups[slot.pizzero]!.push(slot)
    }
  }

  const freeSlots = pizzeroSlots.filter((s) => !s.occupied && s.is_active)

  function handleFreeSlotClick(slot: SlotData) {
    if (slot.slot_type === 'mesa_fija') {
      if (slot.my_request?.status === 'approved') {
        setRegistrarSlot(slot)
      } else {
        setMesaSheetSlot(slot)
      }
    } else {
      setPreselectedSlot(slot)
      setSheetOpen(true)
    }
  }

  // Summary counts
  const counts = {
    active: pizzeroSlots.filter((s) => s.stored_game?.status === 'active').length,
    warning: pizzeroSlots.filter((s) => s.stored_game?.status === 'warning').length,
    critical: pizzeroSlots.filter((s) => ['critical', 'expired'].includes(s.stored_game?.status ?? '')).length,
    free: pizzeroSlots.filter((s) => !s.occupied).length,
  }

  const mesaCounts = {
    occupied: mesaSlots.filter((s) => s.occupied).length,
    free: mesaSlots.filter((s) => !s.occupied).length,
    queued: mesaSlots.reduce((sum, s) => sum + (s.queue_count ?? 0), 0),
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-900 rounded-xl p-1">
        <button
          onClick={() => setTab('pizzeros')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'pizzeros' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Pizzeros
        </button>
        <button
          onClick={() => setTab('mesas')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'mesas' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Mesas Fijas
        </button>
      </div>

      {/* Summary chips */}
      {tab === 'pizzeros' ? (
        <div className="flex gap-2 flex-wrap mb-4">
          <span className="bg-green-950 text-green-300 text-xs px-3 py-1.5 rounded-full">🟢 {counts.active} Activos</span>
          <span className="bg-yellow-950 text-yellow-300 text-xs px-3 py-1.5 rounded-full">🟡 {counts.warning} Aviso</span>
          <span className="bg-red-950 text-red-300 text-xs px-3 py-1.5 rounded-full">🔴 {counts.critical} Crítico</span>
          <span className="bg-slate-800 text-slate-400 text-xs px-3 py-1.5 rounded-full">⬜ {counts.free} Libres</span>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap mb-4">
          <span className="bg-green-950 text-green-300 text-xs px-3 py-1.5 rounded-full">🟢 {mesaCounts.occupied} En uso</span>
          <span className="bg-slate-800 text-slate-400 text-xs px-3 py-1.5 rounded-full">⬜ {mesaCounts.free} Libres</span>
          {mesaCounts.queued > 0 && (
            <span className="bg-indigo-950 text-indigo-300 text-xs px-3 py-1.5 rounded-full">⏳ {mesaCounts.queued} En cola</span>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 bg-slate-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tab === 'pizzeros' ? (
        /* Pizzeros: sections A, B, C */
        <div className="space-y-6">
          {(['A', 'B', 'C'] as const).map((letter) => {
            const groupSlots = pizzeroGroups[letter] ?? []
            if (groupSlots.length === 0) return null
            return (
              <div key={letter}>
                <h2 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                  <span className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-0.5 text-white">
                    Pizzero {letter}
                  </span>
                  <span className="text-slate-600 text-xs">
                    {groupSlots.filter((s) => s.occupied).length}/{groupSlots.length} ocupados
                  </span>
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  {groupSlots.map((slot) => (
                    <SlotCard key={slot.id} slot={slot} onFreeClick={handleFreeSlotClick} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Mesas Fijas */
        <>
          {/* Banner: approved request pending claim */}
          {mesaSlots.some((s) => s.my_request?.status === 'approved') && (
            <div className="mb-3 bg-green-950 border border-green-700 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-green-300 text-sm font-medium">¡Tienes una mesa aprobada!</p>
                <p className="text-green-600 text-xs">Reclámala antes de que expire</p>
              </div>
              <span className="text-2xl">✅</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {mesaSlots.map((slot) => (
              <SlotCard key={slot.id} slot={slot} onFreeClick={handleFreeSlotClick} />
            ))}
          </div>
        </>
      )}

      {/* FAB — only for pizzeros */}
      {tab === 'pizzeros' && (
        <button
          onClick={() => { setPreselectedSlot(null); setSheetOpen(true) }}
          className="fixed bottom-24 right-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full p-4 shadow-lg z-10"
        >
          <Plus size={24} />
        </button>
      )}

      {sheetOpen && (
        <NuevoTableroSheet
          slots={freeSlots}
          preselectedSlot={preselectedSlot}
          onClose={() => setSheetOpen(false)}
          onCreated={() => {
            setSheetOpen(false)
            qc.invalidateQueries({ queryKey: ['slots'] })
          }}
        />
      )}

      {mesaSheetSlot && (
        <SolicitarMesaFijaSheet
          slot={mesaSheetSlot}
          onClose={() => setMesaSheetSlot(null)}
          onCreated={() => {
            setMesaSheetSlot(null)
            qc.invalidateQueries({ queryKey: ['slots'] })
          }}
        />
      )}

      {registrarSlot && (
        <NuevoTableroSheet
          slots={[registrarSlot]}
          preselectedSlot={registrarSlot}
          preselectedGame={
            registrarSlot.my_request?.game_id
              ? { id: registrarSlot.my_request.game_id, name: registrarSlot.my_request.game_name ?? '' }
              : null
          }
          onClose={() => setRegistrarSlot(null)}
          onCreated={() => {
            setRegistrarSlot(null)
            qc.invalidateQueries({ queryKey: ['slots'] })
          }}
        />
      )}
    </div>
  )
}
