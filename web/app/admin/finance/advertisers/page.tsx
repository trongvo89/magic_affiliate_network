'use client'
import { useEffect, useState, useCallback } from 'react'
import { api } from '@/lib/api'

interface Advertiser {
  id: string
  name: string
  email: string | null
  currency: string
}

const BLANK = { name: '', email: '', currency: 'USD' }

export default function AdvertisersPage() {
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Advertiser | null>(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await api.get('/admin/finance/advertisers')
      setAdvertisers(data)
    } catch {
      setError('Failed to load advertisers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm(BLANK)
    setFormError('')
    setShowModal(true)
  }

  function openEdit(a: Advertiser) {
    setEditing(a)
    setForm({ name: a.name, email: a.email || '', currency: a.currency })
    setFormError('')
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      if (editing) {
        await api.patch(`/admin/finance/advertisers/${editing.id}`, {
          name: form.name,
          email: form.email || undefined,
          currency: form.currency,
        })
      } else {
        await api.post('/admin/finance/advertisers', {
          name: form.name,
          email: form.email || undefined,
          currency: form.currency,
        })
      }
      setShowModal(false)
      load()
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this advertiser? This cannot be undone.')) return
    setDeleting(id)
    try {
      await api.delete(`/admin/finance/advertisers/${id}`)
      setAdvertisers((prev) => prev.filter((a) => a.id !== id))
    } catch {
      alert('Failed to delete advertiser')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Advertisers</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage advertiser accounts</p>
        </div>
        <button
          onClick={openCreate}
          className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium">
          + New Advertiser
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-red-700 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                {['Name', 'Email', 'Currency', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : advertisers.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No advertisers yet</td></tr>
              ) : advertisers.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{a.name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{a.email || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600">{a.currency}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openEdit(a)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-200 px-2 py-1 rounded hover:bg-blue-50">
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(a.id)}
                        disabled={deleting === a.id}
                        className="text-xs text-red-600 hover:text-red-800 font-medium border border-red-200 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50">
                        {deleting === a.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                {editing ? 'Edit Advertiser' : 'New Advertiser'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{formError}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Advertiser name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="contact@advertiser.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <input
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                  placeholder="USD"
                  maxLength={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm">
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Advertiser'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
