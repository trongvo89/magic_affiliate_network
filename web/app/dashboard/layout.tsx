'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { getUser, logout } from '@/lib/api'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const u = getUser()
    if (!u || u.role !== 'PUBLISHER') { router.push('/login'); return }
    setUser(u)
  }, [router])

  if (!user) return null

  const navItems = [
    { href: '/dashboard', label: 'Overview', icon: '📊' },
    { href: '/dashboard/offers', label: 'Offers', icon: '📈' },
    { href: '/dashboard/settings', label: 'Settings', icon: '⚙️' },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="font-bold text-gray-900 text-sm">Magic Affiliate</div>
          <div className="text-xs text-gray-500 mt-0.5">Publisher Portal</div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-200">
          <div className="text-xs text-gray-500 mb-2 px-1">{user.email}</div>
          {user.status === 'PENDING' && (
            <div className="bg-yellow-50 text-yellow-700 text-xs px-2 py-1.5 rounded-lg mb-2">
              Account pending approval
            </div>
          )}
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
