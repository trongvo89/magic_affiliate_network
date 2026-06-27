'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, fmtDate, fetchUser, clearUserCache } from '@/lib/api'

interface TeamMember {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'PUBLISHER'
  status: string
  createdAt: string
}

export default function TeamPage() {
  const router = useRouter()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [actionId, setActionId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => { fetchUser().then(u => setCurrentUser(u)) }, [])

  async function load() {
    const { data } = await api.get('/admin/users')
    setMembers(data)
  }
  useEffect(() => { load() }, [])

  async function updateUser(id: string, payload: { role?: string; status?: string }) {
    setActionId(id)
    setError('')
    try {
      await api.put(`/admin/users/${id}`, payload)
      await load()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Action failed')
    } finally {
      setActionId(null)
    }
  }

  async function impersonate(id: string) {
    try {
      await api.post(`/admin/impersonate/${id}`)
      clearUserCache()
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Impersonation failed')
    }
  }

  const admins = members.filter(m => m.role === 'ADMIN')
  const publishers = members.filter(m => m.role === 'PUBLISHER')

  const roleBadge = (role: string) => (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${role === 'ADMIN' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
      {role === 'ADMIN' ? 'Admin' : 'Publisher'}
    </span>
  )

  const statusBadge = (s: string) => {
    const cls: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-700',
      PENDING: 'bg-yellow-100 text-yellow-700',
      SUSPENDED: 'bg-red-100 text-red-700',
    }
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[s] || 'bg-gray-100 text-gray-600'}`}>{s}</span>
  }

  function MemberRow({ m }: { m: TeamMember }) {
    const isSelf = m.id === currentUser?.id
    const isLastAdmin = m.role === 'ADMIN' && admins.length === 1
    return (
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3">
          <div className="font-medium text-gray-900 flex items-center gap-2">
            {m.name}
            {isSelf && <span className="text-xs text-gray-400 font-normal">(you)</span>}
          </div>
          <div className="text-xs text-gray-500">{m.email}</div>
        </td>
        <td className="px-4 py-3">{roleBadge(m.role)}</td>
        <td className="px-4 py-3">{statusBadge(m.status)}</td>
        <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(m.createdAt)}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            {m.role === 'PUBLISHER' && (
              <button
                onClick={() => updateUser(m.id, { role: 'ADMIN', status: 'ACTIVE' })}
                disabled={actionId === m.id}
                className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-2.5 py-1 rounded-md font-medium transition-colors"
              >
                Make Admin
              </button>
            )}
            {m.role === 'ADMIN' && !isSelf && !isLastAdmin && (
              <button
                onClick={() => updateUser(m.id, { role: 'PUBLISHER' })}
                disabled={actionId === m.id}
                className="text-xs bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 px-2.5 py-1 rounded-md font-medium transition-colors"
              >
                Revoke Admin
              </button>
            )}
            {m.role === 'PUBLISHER' && m.status !== 'ACTIVE' && (
              <button
                onClick={() => updateUser(m.id, { status: 'ACTIVE' })}
                disabled={actionId === m.id}
                className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-2.5 py-1 rounded-md font-medium transition-colors"
              >
                Approve
              </button>
            )}
            {!isSelf && m.status !== 'SUSPENDED' && (
              <button
                onClick={() => updateUser(m.id, { status: 'SUSPENDED' })}
                disabled={actionId === m.id}
                className="text-xs bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 px-2.5 py-1 rounded-md font-medium transition-colors"
              >
                Suspend
              </button>
            )}
            {!isSelf && m.status === 'SUSPENDED' && (
              <button
                onClick={() => updateUser(m.id, { status: 'ACTIVE' })}
                disabled={actionId === m.id}
                className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-2.5 py-1 rounded-md font-medium transition-colors"
              >
                Reinstate
              </button>
            )}
            {m.role === 'PUBLISHER' && m.status === 'ACTIVE' && (
              <button
                onClick={() => impersonate(m.id)}
                className="text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-2.5 py-1 rounded-md font-medium transition-colors"
              >
                Login As
              </button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage admin access and user roles</p>
        </div>
        <div className="flex gap-3 text-sm text-gray-500">
          <span><span className="font-semibold text-orange-600">{admins.length}</span> admin{admins.length !== 1 ? 's' : ''}</span>
          <span><span className="font-semibold text-slate-700">{publishers.length}</span> publishers</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}

      {admins.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Admins</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  {['User', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {admins.map(m => <MemberRow key={m.id} m={m} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Publishers</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                {['User', 'Role', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {publishers.map(m => <MemberRow key={m.id} m={m} />)}
              {publishers.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No publishers yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
