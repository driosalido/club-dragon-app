'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Layout, User, ShieldCheck, Ticket } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

const BASE_NAV = [
  { href: '/tableros', label: 'Almacén', icon: Layout },
  { href: '/invitaciones', label: 'Invitados', icon: Ticket },
  { href: '/perfil', label: 'Perfil', icon: User },
]

export default function BottomNav() {
  const pathname = usePathname()

  const { data: me } = useQuery<{ id: string; is_admin: boolean }>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/users/me').then((r) => r.json()),
    staleTime: 60_000,
  })

  const navItems = me?.is_admin
    ? [...BASE_NAV, { href: '/admin', label: 'Admin', icon: ShieldCheck }]
    : BASE_NAV

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 bg-slate-900 border-t border-slate-800">
      <ul className="flex">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
                  active ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon size={22} />
                <span>{label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
