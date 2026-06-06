'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface Profile {
  id: string
  name: string
  email: string
  postbackUrl: string | null
  status: string
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState({ name: '', postbackUrl: '', password: '', currentPassword: '' })
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    api.get('/publisher/profile').then(({ data }) => {
      setProfile(data)
      setForm((f) => ({ ...f, name: data.name || '', postbackUrl: data.postbackUrl || '' }))
    })
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    setSaving(true)
    try {
      const payload: any = { name: form.name, postbackUrl: form.postbackUrl }
      if (form.password) {
        payload.password = form.password
        payload.currentPassword = form.currentPassword
      }
      await api.put('/publisher/profile', payload)
      setMessage({ type: 'success', text: 'Profile updated successfully' })
      setForm((f) => ({ ...f, password: '', currentPassword: '' }))
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  async function handleTestPostback() {
    if (!form.postbackUrl) return
    setTesting(true)
    setTestResult(null)
    try {
      const url = form.postbackUrl
        .replace(/{click_id}/g, 'TEST_CLICK')
        .replace(/{payout}/g, '1.00')
        .replace(/{event}/g, 'test')
        .replace(/{order_id}/g, 'TEST_ORDER')
        .replace(/{status}/g, 'approved')
      await api.get('/publisher/profile')
      setTestResult({ ok: true, msg: `Test postback would fire to: ${url.substring(0, 80)}...` })
    } catch {
      setTestResult({ ok: false, msg: 'Could not validate URL' })
    } finally {
      setTesting(false)
    }
  }

  if (!profile) return <div className="p-6 text-gray-400">Loading...</div>

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Settings</h1>

      {message && (
        <div className={`rounded-lg p-3 mb-4 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Publisher ID</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono bg-gray-50 text-gray-700 select-all">{profile.id}</code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(profile.id)}
                  className="text-sm text-orange-500 hover:text-orange-700 font-medium whitespace-nowrap"
                >Copy</button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Gửi ID này cho Admin để được gắn vào postback URL của advertiser.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={profile.email} disabled
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Postback URL</h2>
          <p className="text-xs text-gray-500 mb-4">Your tracker URL to receive conversion notifications.</p>

          <div className="bg-orange-50 rounded-lg p-3 mb-4 border border-orange-100">
            <p className="text-xs font-medium text-orange-800 mb-1">Available macros:</p>
            <code className="text-xs text-orange-700 font-mono">
              {'{payout}'} &nbsp; {'{event}'} &nbsp; {'{order_id}'} &nbsp; {'{status}'} &nbsp; {'{click_id}'}
            </code>
          </div>

          <div className="space-y-3">
            <textarea
              value={form.postbackUrl}
              onChange={(e) => setForm({ ...form, postbackUrl: e.target.value })}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
              placeholder="https://tracker.example.com/pb?payout={payout}&event={event}&order={order_id}"
            />
            <button
              type="button"
              onClick={handleTestPostback}
              disabled={testing || !form.postbackUrl}
              className="text-sm text-orange-500 hover:text-orange-700 disabled:opacity-50 font-medium"
            >
              {testing ? 'Testing...' : 'Test Postback URL'}
            </button>
            {testResult && (
              <div className={`text-xs rounded-lg p-2 ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {testResult.msg}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Change Password</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                value={form.currentPassword}
                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="••••••••"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
