'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Tables } from '@/types/database'

type User = Tables<'users'>

interface Game {
  id: string
  name: string
  category: string | null
  thumbnail_url: string | null
}

interface GameWithInterest {
  game: Game
  interest_level: 'want_to_play' | 'own_and_teach' | 'learning'
}

interface Props {
  user: User
}

const INTEREST_LABELS = {
  want_to_play: 'Quiero jugar',
  own_and_teach: 'Lo tengo y enseño',
  learning: 'Aprendiendo',
}

const DAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']

export default function OnboardingWizard({ user }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)

  // Step 1
  const [displayName, setDisplayName] = useState(user.display_name ?? '')
  const [bio, setBio] = useState(user.bio ?? '')

  // Step 2
  const [gameSearch, setGameSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Game[]>([])
  const [selectedGames, setSelectedGames] = useState<GameWithInterest[]>([])
  const [gameModalOpen, setGameModalOpen] = useState(false)
  const [pendingGame, setPendingGame] = useState<Game | null>(null)

  // Step 3
  const [activeDays, setActiveDays] = useState<number[]>([])

  const [saving, setSaving] = useState(false)

  async function searchGames(q: string) {
    if (!q.trim()) { setSearchResults([]); return }
    const res = await fetch(`/api/games?q=${encodeURIComponent(q)}`)
    if (res.ok) {
      const data = await res.json() as Game[]
      setSearchResults(data)
    }
  }

  function selectGame(game: Game) {
    if (selectedGames.some((g) => g.game.id === game.id)) return
    setPendingGame(game)
    setGameModalOpen(true)
  }

  function confirmInterest(level: 'want_to_play' | 'own_and_teach' | 'learning') {
    if (!pendingGame) return
    setSelectedGames((prev) => [...prev, { game: pendingGame, interest_level: level }])
    setGameModalOpen(false)
    setPendingGame(null)
  }

  function toggleDay(day: number) {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  async function finish() {
    setSaving(true)
    try {
      // Save name/bio
      await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName, bio: bio || undefined }),
      })

      // Save games
      for (const { game, interest_level } of selectedGames) {
        await fetch('/api/users/me/games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ game_id: game.id, interest_level }),
        })
      }

      // Save availability
      if (activeDays.length > 0) {
        await fetch('/api/users/me/availability', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(activeDays.map((d) => ({ day_of_week: d }))),
        })
      }

      router.push('/partidas')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-800">
        {/* Steps indicator */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-indigo-500' : 'bg-slate-700'}`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-white">Bienvenido al Club 🐉</h2>
            <p className="text-slate-400 text-sm">Confirma cómo quieres que te llamen</p>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Nombre</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-400">Bio (opcional)</span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                rows={3}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 resize-none"
              />
            </label>

            <button
              onClick={() => setStep(2)}
              disabled={!displayName.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2 font-medium mt-2"
            >
              Siguiente →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-white">¿Qué juegos te interesan?</h2>

            <input
              value={gameSearch}
              onChange={(e) => {
                setGameSearch(e.target.value)
                searchGames(e.target.value)
              }}
              placeholder="Buscar juego..."
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
            />

            {searchResults.length > 0 && (
              <ul className="bg-slate-800 rounded-lg divide-y divide-slate-700 max-h-48 overflow-y-auto">
                {searchResults.map((game) => (
                  <li key={game.id}>
                    <button
                      onClick={() => selectGame(game)}
                      className="w-full text-left px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
                    >
                      {game.name}
                      {game.category && (
                        <span className="ml-2 text-xs text-slate-500">{game.category}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {selectedGames.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedGames.map(({ game, interest_level }) => (
                  <span
                    key={game.id}
                    className="bg-indigo-900 text-indigo-200 text-xs px-2 py-1 rounded-full"
                  >
                    {game.name} · {INTEREST_LABELS[interest_level]}
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setStep(3)}
                className="flex-1 text-slate-400 hover:text-slate-200 text-sm py-2"
              >
                Omitir
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2 font-medium"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-white">¿Cuándo estás disponible?</h2>
            <p className="text-slate-400 text-sm">Selecciona los días en que sueles venir al club</p>

            <div className="flex gap-2">
              {DAYS.map((label, day) => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeDays.includes(day)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex gap-2 mt-2">
              <button
                onClick={finish}
                disabled={saving}
                className="flex-1 text-slate-400 hover:text-slate-200 text-sm py-2"
              >
                Omitir
              </button>
              <button
                onClick={finish}
                disabled={saving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg py-2 font-medium"
              >
                {saving ? 'Guardando...' : 'Finalizar ✓'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Interest level modal */}
      {gameModalOpen && pendingGame && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-1">{pendingGame.name}</h3>
            <p className="text-slate-400 text-sm mb-4">¿Cuál es tu nivel de interés?</p>
            <div className="flex flex-col gap-2">
              {(Object.entries(INTEREST_LABELS) as [keyof typeof INTEREST_LABELS, string][]).map(
                ([level, label]) => (
                  <button
                    key={level}
                    onClick={() => confirmInterest(level)}
                    className="bg-slate-800 hover:bg-slate-700 text-white rounded-lg py-2.5 px-4 text-sm text-left"
                  >
                    {label}
                  </button>
                )
              )}
            </div>
            <button
              onClick={() => setGameModalOpen(false)}
              className="mt-3 w-full text-slate-500 text-sm py-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
