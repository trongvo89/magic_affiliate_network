'use client'
import { useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { LogoMark } from '@/components/LogoMark'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSent(true)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      <div className="absolute -top-48 -right-48 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-48 -left-48 w-96 h-96 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md px-4">
        <div className="flex flex-col items-center mb-6">
          <LogoMark size={100} />
          <p className="text-slate-400 text-sm mt-1 tracking-wide">Performance Marketing Network</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-amber-400 via-orange-500 to-orange-600" />
          <div className="p-8">
            {sent ? (
              <div className="text-center">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">Check your email</h2>
                <p className="text-slate-500 text-sm mb-6">
                  If <strong>{email}</strong> is registered, you'll receive a password reset link shortly. The link expires in 1 hour.
                </p>
                <Link href="/login" className="text-orange-500 hover:text-orange-600 text-sm font-medium">
                  ← Back to Sign In
                </Link>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-bold text-slate-900 text-center mb-2">Forgot password?</h1>
                <p className="text-slate-500 text-sm text-center mb-6">
                  Enter your email and we'll send you a reset link.
                </p>

                {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
                  >
                    {loading ? 'Sending...' : 'Send Reset Link'}
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
      </div>
    </div>
  )
}
