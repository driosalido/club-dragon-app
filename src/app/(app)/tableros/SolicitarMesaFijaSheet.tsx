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

interface BggResult {
  bgg_id: number
  name: string
  year: number | null
}

interface Props {
  slot: SlotData
  onClose: () => void
  onCreated: () => void
}

export default function SolicitarMesaFijaSheet({ slot, onClose, onCreated }: Props) {
  const [gameSearch, setGameSearch] = useState('')
  const [localResults, setLocalResults] = useState<Game[]>([])
  const [bggResults, setBggResults] = useState<BggResult[]>([])
  const [gameSearching, setGameSearching] = useState(false)
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [reason, setReason] = useState('')
  const [expectedDurationMonths, setExpectedDurationMonths] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requestSubmitted, setRequestSubmitted] = useState(false)

  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleGameInput(q: string) {
    setGameSearch(q)
    setSelectedGame(null)
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    if (!q.trim()) { setLocalResults([]); setBggResults([]); return }
    searchDebounce.current = setTimeout(async () => {
      setGameSearching(true)
      try {
        const [localRes, bggRes] = await Promise.all([
          fetch(`/api/games?q=${encodeURIComponent(q)}`),
          fetch(`/api/games/bgg/search?q=${encodeURIComponent(q)}`),
        ])
        if (localRes.ok) setLocalResults(await localRes.json() as Game[])
        if (bggRes.ok) setBggResults(await bggRes.json() as BggResult[])
      } finally {
        setGameSearching(false)
      }
    }, 300)
  }

  function selectGame(game: Game) {
    setSelectedGame(game)
    setGameSearch(game.name)
    setLocalResults([])
    setBggResults([])
  }

  async function selectBggGame(result: BggResult) {
    setGameSearching(true)
    setLocalResults([])
    setBggResults([])
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: result.name, bgg_id: result.bgg_id }),
      })
      if (res.ok) {
        const game = await res.json() as Game
        setSelectedGame(game)
        setGameSearch(game.name)
      }
    } finally {
      setGameSearching(false)
    }
  }

  async function createAndSelectGame() {
    if (!gameSearch.trim()) return
    setGameSearching(true)
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: gameSearch.trim() }),
      })
      if (res.ok) {
        const game = await res.json() as Game
        setSelectedGame(game)
        setLocalResults([])
        setBggResults([])
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
          expected_duration_months: expectedDurationMonths ? Number(expectedDurationMonths) : undefined,
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
      await res.json()
      setRequestSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  const slotName = slot.label?.trim() || `Mesa ${slot.slot_number}`
  const hasResults = localResults.length > 0 || bggResults.length > 0

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

        <div className="bg-slate-800 rounded-xl p-3 mb-6">
          <p className="text-sm text-slate-400">Mesa solicitada</p>
          <p className="text-base font-medium text-white">{slotName}</p>
          {(slot.queue_count ?? 0) > 0 && (
            <p className="text-xs text-indigo-400 mt-1">⏳ {slot.queue_count} persona{slot.queue_count !== 1 ? 's' : ''} en cola</p>
          )}
        </div>

        {requestSubmitted ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-lg font-semibold text-white mb-2">¡Solicitud enviada!</h3>
            <p className="text-slate-400 text-sm mb-2">
              Tu solicitud está ahora en estado <span className="text-amber-300 font-bold">pendiente</span>.
            </p>
            <p className="text-slate-500 text-xs mb-6">
              La junta revisará tu solicitud y, si se aprueba, pasará a la cola de la mesa.
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
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">Juego</label>
              <input
                type="text"
                placeholder="Buscar juego..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                data-1p-ignore="true"
                data-lpignore="true"
                value={gameSearch}
                onChange={(e) => handleGameInput(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              {gameSearching && (
                <p className="text-xs text-slate-500 mt-1 ml-1">Buscando...</p>
              )}
              {!selectedGame && hasResults && (
                <ul className="mt-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-700 max-h-64 overflow-y-auto">
                  {localResults.map((g) => (
                    <li key={g.id}>
                      <button
                        onClick={() => selectGame(g)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-700 transition-colors"
                      >
                        <span className="text-sm text-white">{g.name}</span>
                        <span className="text-xs text-green-500 ml-2 shrink-0">en club</span>
                      </button>
                    </li>
                  ))}
                  {bggResults
                    .filter((b) => !localResults.some((l) => l.name.toLowerCase() === b.name.toLowerCase()))
                    .map((b) => (
                      <li key={b.bgg_id}>
                        <button
                          onClick={() => selectBggGame(b)}
                          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-700 transition-colors"
                        >
                          <span className="text-sm text-white">
                            {b.name}{b.year ? <span className="text-slate-500 ml-1">({b.year})</span> : null}
                          </span>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <span className="text-xs text-indigo-400">BGG</span>
                            <ChevronRight size={14} className="text-slate-500" />
                          </div>
                        </button>
                      </li>
                    ))}
                </ul>
              )}
              {!selectedGame && gameSearch.trim() && !gameSearching && !hasResults && (
                <button
                  onClick={createAndSelectGame}
                  className="mt-2 w-full text-left px-4 py-2 bg-slate-800 border border-dashed border-slate-600 rounded-xl text-sm text-indigo-400 hover:border-indigo-500 transition-colors"
                >
                  + Usar &ldquo;{gameSearch.trim()}&rdquo;
                </button>
              )}
              {selectedGame && (
                <p className="text-xs text-green-400 mt-1 ml-1">✓ {selectedGame.name}</p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-2">Duración estimada (meses) <span className="text-slate-600">(opcional)</span></label>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={24}
                step={1}
                placeholder="Ej. 6"
                value={expectedDurationMonths}
                onChange={(e) => setExpectedDurationMonths(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

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
