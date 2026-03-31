'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, Check, X, Shield } from 'lucide-react'
import { useEffect } from 'react'

interface Member {
  id: string
  display_name: string
  telegram_username: string | null
  avatar_url: string | null
  member_number: number | null
  is_admin: boolean
  is_active: boolean
  created_at: string
}

interface PatchPayload {
  member_number?: number | null
  is_admin?: boolean
}

export default function AdminSociosPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Record<string, { member_number: string }>>({})

  const { data: me } = useQuery<{ id: string; is_admin: boolean }>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/users/me').then((r) => r.json()),
  })

  useEffect(() => {
    if (me && !me.is_admin) router.replace('/tableros')
  }, [me, router])

  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: ['admin-members'],
    queryFn: () => fetch('/api/users').then((r) => r.json()),
    enabled: !!me?.is_admin,
  })

  const patch = useMutation({
    mutationFn: ({ id, data }: { id: string; data: PatchPayload }) =>
      fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-members'] })
      qc.invalidateQueries({ queryKey: ['me'] })
    },
  })

  function startEdit(member: Member) {
    setEditing((prev) => ({
      ...prev,
      [member.id]: { member_number: member.member_number?.toString() ?? '' },
    }))
  }

  function cancelEdit(id: string) {
    setEditing((prev) => { const next = { ...prev }; delete next[id]; return next })
  }

  function saveEdit(id: string) {
    const draft = editing[id]
    if (!draft) return
    const n = parseInt(draft.member_number)
    patch.mutate(
      { id, data: { member_number: isNaN(n) || n < 1 ? null : n } },
      { onSuccess: () => cancelEdit(id) }
    )
  }

  function toggleAdmin(member: Member) {
    if (member.id === me?.id && member.is_admin) {
      window.alert('No puedes quitarte permisos de admin a ti mismo desde esta pantalla.')
      return
    }

    const makingAdmin = !member.is_admin
    const confirmed = window.confirm(
      makingAdmin
        ? `¿Convertir a ${member.display_name} en admin?`
        : `¿Quitar permisos de admin a ${member.display_name}?`
    )
    if (!confirmed) return

    patch.mutate({ id: member.id, data: { is_admin: makingAdmin } })
  }

  if (!me) return <div className="p-4"><div className="h-48 bg-slate-900 rounded-xl animate-pulse" /></div>
  if (!me.is_admin) return null

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <Link href="/admin" className="flex items-center gap-1 text-slate-400 text-sm hover:text-slate-200">
        <ArrowLeft size={16} /> Admin
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Admin · Socios</h1>
        <Link
          href="/admin/mesas-fijas"
          className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-800 rounded-lg px-3 py-1.5"
        >
          Mesas Fijas →
        </Link>
      </div>
      <p className="text-slate-400 text-sm">{members.length} socios registrados</p>
      <p className="text-slate-500 text-xs -mt-2">
        Usa "Editar n.º socio" para asignar o cambiar el número de socio.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-slate-900 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-slate-900 rounded-xl border border-slate-800 divide-y divide-slate-800">
          {members.map((member) => {
            const isEditing = !!editing[member.id]
            return (
              <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                {/* Avatar */}
                {member.avatar_url ? (
                  <img
                    src={member.avatar_url}
                    alt={member.display_name}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-800 flex items-center justify-center text-sm font-bold text-white shrink-0">
                    {member.display_name[0]?.toUpperCase()}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {member.display_name}
                    {member.is_admin && <span className="ml-2 text-xs text-indigo-400">admin</span>}
                    {!member.is_active && <span className="ml-2 text-xs text-red-400">inactivo</span>}
                  </p>
                  {member.telegram_username && (
                    <p className="text-xs text-slate-500">@{member.telegram_username}</p>
                  )}
                </div>

                {/* Member number */}
                {isEditing ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs text-slate-500">#</span>
                    <input
                      autoFocus
                      type="number"
                      min={1}
                      value={editing[member.id]!.member_number}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [member.id]: { member_number: e.target.value },
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(member.id)
                        if (e.key === 'Escape') cancelEdit(member.id)
                      }}
                      aria-label="Numero de socio"
                      className="w-16 bg-slate-800 border border-indigo-600 rounded px-2 py-1 text-sm text-white focus:outline-none"
                    />
                    <button
                      onClick={() => saveEdit(member.id)}
                      disabled={patch.isPending}
                      className="text-green-400 hover:text-green-300 disabled:opacity-50"
                    >
                      <Check size={16} />
                    </button>
                    <button onClick={() => cancelEdit(member.id)} className="text-slate-500 hover:text-slate-300">
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleAdmin(member)}
                      disabled={patch.isPending || (member.id === me.id && member.is_admin)}
                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        member.is_admin
                          ? 'text-indigo-300 border-indigo-700 bg-indigo-950/40 hover:bg-indigo-900/50'
                          : 'text-slate-400 border-slate-700 bg-slate-800/60 hover:bg-slate-700/70'
                      }`}
                      title={member.is_admin ? 'Quitar admin' : 'Hacer admin'}
                    >
                      <Shield size={12} />
                      {member.is_admin ? 'Admin' : 'Hacer admin'}
                    </button>
                    <span className="text-sm text-slate-400 min-w-[3rem] text-right">
                      {member.member_number ? `#${member.member_number}` : <span className="text-slate-600">—</span>}
                    </span>
                    <button
                      onClick={() => startEdit(member)}
                      title="Editar numero de socio"
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <Pencil size={14} />
                      <span>Editar n.º socio</span>
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
