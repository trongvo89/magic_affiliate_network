'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { api, fetchUser, logout, clearUserCache, isImpersonating } from '@/lib/api'
import { LogoMark } from '@/components/LogoMark'
import { LocaleProvider, useLocale } from '@/lib/i18n'

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { locale, setLocale } = useLocale()
  const [user, setUser] = useState<any>(null)
  const [impersonating, setImpersonating] = useState(false)

  useEffect(() => {
    fetchUser().then(u => {
      if (!u || u.role !== 'PUBLISHER') { router.push('/login'); return }
      setUser(u)
      setImpersonating(isImpersonating())
    })
  }, [router])

  async function exitImpersonation() {
    await api.post('/admin/exit-impersonate')
    clearUserCache()
    window.location.href = '/admin'
  }

  if (!user) return null

  const navItems = [
    {
      href: '/dashboard',
      label: 'Overview',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      href: '/dashboard/offers',
      label: 'Offers',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
    },
    {
      href: '/dashboard/report',
      label: 'Report',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      href: '/dashboard/finance',
      label: 'Finance',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      href: '/dashboard/settings',
      label: 'Settings',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="w-60 bg-[#0F172A] flex flex-col flex-shrink-0">
        {/* Logo — PNG has dark bg, blends with sidebar */}
        <div className="px-6 py-4 border-b border-white/10 flex justify-center">
          <LogoMark size={160} />
        </div>

        {/* Nav label */}
        <div className="px-5 pt-5 pb-2">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Publisher Portal</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-orange-500/10 text-orange-400'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className={isActive ? 'text-orange-400' : 'text-slate-500'}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="text-xs text-slate-500 mb-2 px-2 truncate">{user.email}</div>
          {user.status === 'PENDING' && (
            <div className="bg-amber-500/10 text-amber-400 text-xs px-2 py-1.5 rounded-lg mb-2 border border-amber-500/20">
              Account pending approval
            </div>
          )}
          <button
            onClick={() => setLocale(locale === 'vi' ? 'en' : 'vi')}
            className="w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded-full bg-white/5 text-xs font-medium mb-2"
          >
            <span className={locale === 'en' ? 'text-orange-400' : 'text-slate-500'}>EN</span>
            <span className="text-slate-600">|</span>
            <span className={locale === 'vi' ? 'text-orange-400' : 'text-slate-500'}>VI</span>
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        {impersonating && (
          <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between text-sm font-medium">
            <span>Viewing as {user.email} (read-only)</span>
            <button onClick={exitImpersonation} className="bg-white text-amber-700 px-3 py-1 rounded-md text-xs font-bold hover:bg-amber-50 transition-colors">
              Exit
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <LocaleProvider><DashboardLayoutInner>{children}</DashboardLayoutInner></LocaleProvider>
}
