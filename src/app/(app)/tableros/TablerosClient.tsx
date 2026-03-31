'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import NuevoTableroSheet from './NuevoTableroSheet'

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

interface SlotData {
  id: string
  slot_number: number
  label: string | null
  is_active: boolean
  occupied: boolean
  stored_game: StoredGameData | null
}

const STATUS_CONFIG: Record<string, { color: string; border: string; dot: string; label: string }> = {
  active: { color: 'bg-green-950', border: 'border-green-800', dot: '🟢', label: 'Activo' },
  warning: { color: 'bg-yellow-950', border: 'border-yellow-700', dot: '🟡', label: 'Aviso' },
  critical: { color: 'bg-red-950', border: 'border-red-700', dot: '🔴', label: 'Crítico' },
  expired: { color: 'bg-red-950', border: 'border-red-600', dot: '💀', label: 'Expirado' },
}

export default function TablerosClient() {
  const qc = useQueryClient()
  const [sheetOpen, setSheetOpen] = useState(false)

  const { data: slots = [], isLoading } = useQuery<SlotData[]>({
    queryKey: ['slots'],
    queryFn: () => fetch('/api/storage/slots').then((r) => r.json()),
    refetchInterval: 30000,
  })

  const counts = {
    active: slots.filter((s) => s.stored_game?.status === 'active').length,
    warning: slots.filter((s) => s.stored_game?.status === 'warning').length,
    critical: slots.filter((s) => ['critical', 'expired'].includes(s.stored_game?.status ?? '')).length,
    free: slots.filter((s) => !s.occupied).length,
  }

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Summary chips */}
      <div className="flex gap-2 flex-wrap mb-4">
        <span className="bg-green-950 text-green-300 text-xs px-3 py-1.5 rounded-full">🟢 {counts.active} Activos</span>
        <span className="bg-yellow-950 text-yellow-300 text-xs px-3 py-1.5 rounded-full">🟡 {counts.warning} Aviso</span>
        <span className="bg-red-950 text-red-300 text-xs px-3 py-1.5 rounded-full">🔴 {counts.critical} Crítico</span>
        <span className="bg-slate-800 text-slate-400 text-xs px-3 py-1.5 rounded-full">⬜ {counts.free} Libres</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-900 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {slots.map((slot) => {
            const sg = slot.stored_game
            const statusCfg = sg ? (STATUS_CONFIG[sg.status] ?? STATUS_CONFIG.active) : null

            if (!slot.is_active) {
              return (
                <div key={slot.id} className="bg-slate-900 rounded-xl p-3 border border-slate-800 opacity-50">
                  <p className="text-xs text-slate-500">Slot {slot.slot_number}</p>
                  <p className="text-xs text-slate-600 mt-1">Inactivo</p>
                </div>
              )
            }

            if (!slot.occupied || !sg) {
              return (
                <button
                  key={slot.id}
                  onClick={() => setSheetOpen(true)}
                  className="bg-slate-900 hover:bg-slate-800 rounded-xl p-3 border border-slate-800 border-dashed text-left transition-colors"
                >
                  <p className="text-xs text-slate-500 mb-1">Slot {slot.slot_number}{slot.label ? ` · ${slot.label}` : ''}</p>
                  <div className="flex items-center gap-1 text-slate-600">
                    <Plus size={14} />
                    <span className="text-xs">Disponible</span>
                  </div>
                </button>
              )
            }

            return (
              <Link
                key={slot.id}
                href={`/tableros/${sg.id}`}
                className={`rounded-xl p-3 border transition-colors hover:opacity-90 ${statusCfg!.color} ${statusCfg!.border}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-slate-400">Slot {slot.slot_number}</p>
                  <span className="text-sm">{statusCfg!.dot}</span>
                </div>
                <p className="text-sm font-medium text-white truncate mb-1">
                  {sg.game?.name ?? 'Juego desconocido'}
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
          })}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-24 right-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full p-4 shadow-lg z-10"
      >
        <Plus size={24} />
      </button>

      {sheetOpen && (
        <NuevoTableroSheet
          slots={slots.filter((s) => !s.occupied && s.is_active)}
          onClose={() => setSheetOpen(false)}
          onCreated={() => {
            setSheetOpen(false)
            qc.invalidateQueries({ queryKey: ['slots'] })
          }}
        />
      )}
    </div>
  )
}
