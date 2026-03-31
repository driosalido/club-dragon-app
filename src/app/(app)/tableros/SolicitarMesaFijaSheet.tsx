'use client'

import { useState, useRef } from 'react'
import { X, ChevronRight } from 'lucide-react'

interface SlotData {
  id: string
  slot_number: number
  label: string | null
  queue_count: number
}

interface Game {
  id: string
  name: string
}

interface Props {
  slot: SlotData
  onClose: () => void
  onCreated: () => void
}

export default function SolicitarMesaFijaSheet({ slot, onClose, onCreated }: Props) {
  const [gameSearch, setGameSearch] = useState('')
  const [gameResults, setGameResults] = useState<Game[]>([])
  const [gameSearching, setGameSearching] = useState(false)
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [bggId, setBggId] = useState('')
  const [showBggField, setShowBggField] = useState(false)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queuePosition, setQueuePosition] = useState<number | null>(null)

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleGameInput(q: string) {
    setGameSearch(q)
    setSelectedGame(null)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    if (!q.trim()) { setGameResults([]); return }
    searchDebounce.current = setTimeout(async () => {
      setGameSearching(true)
      try {
        const res = await fetch(`/api/games?q=${encodeURIComponent(q)}`)
        if (res.ok) setGameResults(await res.json() as Game[])
      } finally {
        setGameSearching(false)
      }
    }, 300)
  }

  function selectGame(game: Game) {
    setSelectedGame(game)
    setGameSearch(game.name)
    setGameResults([])
  }

  async function createAndSelectGame() {
    if (!gameSearch.trim()) return
    setGameSearching(true)
    try {
      const body: Record<string, unknown> = { name: gameSearch.trim() }
      const parsedBgg = bggId.trim() ? parseInt(bggId.trim()) : NaN
      if (!isNaN(parsedBgg) && parsedBgg > 0) body.bgg_id = parsedBgg
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const game = await res.json() as Game
        setSelectedGame(game)
        setGameResults([])
      }
    } finally {
      setGameSearching(false)
    }
  }

  async function handleSubmit() {
    if (!selectedGame) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/storage/mesa-fija-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot_id: slot.id,
          game_id: selectedGame.id,
          reason: reason.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string; code?: string }
        if (data.code === 'DUPLICATE_REQUEST') {
          setError('Ya tienes una solicitud activa para esta mesa.')
        } else {
          setError(data.error ?? 'Error al enviar la solicitud')
        }
        return
      }
      const data = await res.json() as { queue_position: number }
      setQueuePosition(data.queue_position)
    } finally {
      setSubmitting(false)
    }
  }

  const slotName = `Mesa ${slot.slot_number}${slot.label ? ` · ${slot.label}` : ''}`

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 rounded-t-2xl border-t border-slate-700 p-6 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Solicitar mesa fija</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Slot info */}
        <div className="bg-slate-800 rounded-xl p-3 mb-6">
          <p className="text-sm text-slate-400">Mesa solicitada</p>
          <p className="text-base font-medium text-white">{slotName}</p>
          {(slot.queue_count ?? 0) > 0 && (
            <p className="text-xs text-indigo-400 mt-1">⏳ {slot.queue_count} persona{slot.queue_count !== 1 ? 's' : ''} en cola</p>
          )}
        </div>

        {queuePosition !== null ? (
          /* Success state */
          <div className="text-center py-6">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-lg font-semibold text-white mb-2">¡Solicitud enviada!</h3>
            <p className="text-slate-400 text-sm mb-2">
              Estás en la posición <span className="text-indigo-400 font-bold">#{queuePosition}</span> de la cola.
            </p>
            <p className="text-slate-500 text-xs mb-6">
              La junta revisará tu solicitud y recibirás una notificación por Telegram cuando sea aprobada.
            </p>
            <button
              onClick={onCreated}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-medium"
            >
              Entendido
            </button>
          </div>
        ) : (
          <>
            {/* Game search */}
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">Juego</label>
              <input
                type="text"
                placeholder="Buscar juego..."
                value={gameSearch}
                onChange={(e) => handleGameInput(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              {gameSearching && (
                <p className="text-xs text-slate-500 mt-1 ml-1">Buscando...</p>
              )}
              {gameResults.length > 0 && (
                <ul className="mt-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-700">
                  {gameResults.map((g) => (
                    <li key={g.id}>
                      <button
                        onClick={() => selectGame(g)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-700 transition-colors"
                      >
                        <span className="text-sm text-white">{g.name}</span>
                        <ChevronRight size={16} className="text-slate-500" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!selectedGame && gameSearch.trim() && !gameSearching && (
                <button
                  onClick={createAndSelectGame}
                  className="mt-2 w-full text-left px-4 py-2 bg-slate-800 border border-dashed border-slate-600 rounded-xl text-sm text-indigo-400 hover:border-indigo-500 transition-colors"
                >
                  + Usar &ldquo;{gameSearch.trim()}&rdquo;
                </button>
              )}
              {!selectedGame && gameSearch.trim() && (
                <div className="mt-2">
                  {!showBggField ? (
                    <button
                      onClick={() => setShowBggField(true)}
                      className="text-xs text-slate-500 hover:text-slate-300 underline"
                    >
                      Añadir ID de BGG (opcional)
                    </button>
                  ) : (
                    <input
                      type="number"
                      placeholder="ID de BoardGameGeek"
                      value={bggId}
                      onChange={(e) => setBggId(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
                    />
                  )}
                </div>
              )}
              {selectedGame && (
                <p className="text-xs text-green-400 mt-1 ml-1">✓ {selectedGame.name}</p>
              )}
            </div>

            {/* Reason (optional) */}
            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-2">Motivo <span className="text-slate-600">(opcional)</span></label>
              <textarea
                rows={3}
                placeholder="Explica brevemente para qué necesitas la mesa..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center bg-red-950/40 border border-red-900 rounded-lg px-4 py-2 mb-4">
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!selectedGame || submitting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl py-3 font-medium transition-colors"
            >
              {submitting ? 'Enviando...' : 'Solicitar mesa'}
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
