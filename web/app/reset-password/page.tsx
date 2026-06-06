'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import { LogoMark } from '@/components/LogoMark'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) setError('Missing reset token. Please use the link from your email.')
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
      setTimeout(() => router.push('/login'), 3000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Reset failed. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-orange-600" />
      <div className="p-8">
        {done ? (
          <div className="text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Password updated!</h2>
            <p className="text-slate-500 text-sm mb-4">Your password has been reset successfully. Redirecting to sign in...</p>
            <Link href="/login" className="text-orange-500 hover:text-orange-600 text-sm font-medium">
              Go to Sign In →
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900 text-center mb-2">Set new password</h1>
            <p className="text-slate-500 text-sm text-center mb-6">Must be at least 8 characters.</p>

            {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4">{error}</div>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !token}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                {loading ? 'Updating...' : 'Reset Password'}
              </button>
            </form>

            <p className="text-center mt-5 text-sm text-slate-400">
              <Link href="/login" className="text-orange-500 hover:text-orange-600 font-medium">
                ← Back to Sign In
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      <div className="absolute -top-48 -right-48 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative w-full max-w-md px-4">
        <div className="flex flex-col items-center mb-6">
          <LogoMark size={100} />
          <p className="text-slate-400 text-sm mt-1 tracking-wide">Performance Marketing Network</p>
        </div>
        <Suspense fallback={<div className="bg-white rounded-2xl shadow-2xl p-8 text-center text-slate-400">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
