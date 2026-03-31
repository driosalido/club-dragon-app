'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { X } from 'lucide-react'

const PropuestaSchema = z.object({
  game_id: z.string().uuid({ message: 'Selecciona un juego válido' }),
  scheduled_date: z.string().min(1, 'La fecha es requerida'),
  scheduled_time_start: z.string().optional(),
  location_type: z.enum(['club', 'home', 'online']),
  location_details: z.string().max(500).optional(),
  min_players: z.number().int().min(2, 'Mínimo 2 jugadores'),
  max_players: z.number().int().min(2),
  title: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
}).refine((d) => d.max_players >= d.min_players, {
  message: 'El máximo debe ser ≥ al mínimo',
  path: ['max_players'],
})

type FormValues = z.infer<typeof PropuestaSchema>

interface Game {
  id: string
  name: string
}

interface Props {
  onClose: () => void
  onCreated: () => void
}

export default function PropuestaSheet({ onClose, onCreated }: Props) {
  const [gameSearch, setGameSearch] = useState('')
  const [gameResults, setGameResults] = useState<Game[]>([])
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(PropuestaSchema),
    defaultValues: { location_type: 'club', min_players: 2, max_players: 4 },
  })

  async function searchGames(q: string) {
    setGameSearch(q)
    if (!q.trim()) { setGameResults([]); return }
    const res = await fetch(`/api/games?q=${encodeURIComponent(q)}`)
    if (res.ok) setGameResults(await res.json())
  }

  function selectGame(game: Game) {
    setSelectedGame(game)
    setValue('game_id', game.id)
    setGameSearch(game.name)
    setGameResults([])
  }

  async function onSubmit(data: FormValues) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json() as { error: string }
        throw new Error(err.error)
      }
      onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al crear la partida')
    } finally {
      setSubmitting(false)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50">
      <div className="bg-slate-900 rounded-t-2xl w-full max-w-lg border-t border-slate-700 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-slate-900 border-b border-slate-800 z-10">
          <h2 className="text-lg font-bold text-white">Proponer partida</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          {/* Game search */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Juego *</label>
            <input
              value={gameSearch}
              onChange={(e) => searchGames(e.target.value)}
              placeholder="Buscar juego..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
            {gameResults.length > 0 && (
              <ul className="bg-slate-800 border border-slate-700 rounded-lg mt-1 divide-y divide-slate-700 max-h-40 overflow-y-auto">
                {gameResults.map((game) => (
                  <li key={game.id}>
                    <button
                      type="button"
                      onClick={() => selectGame(game)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
                    >
                      {game.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {errors.game_id && <p className="text-red-400 text-xs mt-1">{errors.game_id.message}</p>}
            <input type="hidden" {...register('game_id')} />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Fecha *</label>
            <input
              type="date"
              min={today}
              {...register('scheduled_date')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
            {errors.scheduled_date && <p className="text-red-400 text-xs mt-1">{errors.scheduled_date.message}</p>}
          </div>

          {/* Time */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Hora de inicio</label>
            <input
              type="time"
              {...register('scheduled_time_start')}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Lugar *</label>
            <div className="flex gap-2">
              {(['club', 'home', 'online'] as const).map((loc) => (
                <label key={loc} className="flex-1">
                  <input type="radio" value={loc} {...register('location_type')} className="sr-only" />
                  <span className={`block text-center py-2 rounded-lg text-sm cursor-pointer border transition-colors`}>
                    {loc === 'club' ? '🏛 Club' : loc === 'home' ? '🏠 Casa' : '💻 Online'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Location details */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Detalle del lugar</label>
            <input
              {...register('location_details')}
              placeholder="Ej. Mesa 3, sala de juegos..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Players */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Mín. jugadores *</label>
              <input
                type="number"
                min={2}
                {...register('min_players', { valueAsNumber: true })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
              {errors.min_players && <p className="text-red-400 text-xs mt-1">{errors.min_players.message}</p>}
            </div>
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1">Máx. jugadores *</label>
              <input
                type="number"
                min={2}
                {...register('max_players', { valueAsNumber: true })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
              {errors.max_players && <p className="text-red-400 text-xs mt-1">{errors.max_players.message}</p>}
            </div>
          </div>

          {/* Title (optional) */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Título (opcional)</label>
            <input
              {...register('title')}
              placeholder="Ej. Campaña campaña inicial..."
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Descripción (opcional)</label>
            <textarea
              {...register('description')}
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-950 border border-red-800 rounded-lg p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl py-3 font-semibold"
          >
            {submitting ? 'Creando...' : 'Proponer partida'}
          </button>
        </form>
      </div>
    </div>
  )
}
