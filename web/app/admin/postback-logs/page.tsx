'use client'
import { useEffect, useState, useCallback } from 'react'
import { api, fmtDate } from '@/lib/api'

interface PostbackLog {
  id: string
  source: string
  receivedAt: string
  rawQuery: Record<string, string>
  result: 'ok' | 'error'
  reason?: string
  conversionId?: string
  offerId?: string
  publisherId?: string
  xid?: string
  status?: string
}

const SOURCE_COLORS: Record<string, string> = {
  cityads: 'bg-orange-100 text-orange-700',
  appsflyer: 'bg-blue-100 text-blue-700',
  adjust: 'bg-purple-100 text-purple-700',
}

export default function PostbackLogsPage() {
  const [logs, setLogs] = useState<PostbackLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [retryResult, setRetryResult] = useState<{ retried: number; succeeded: number; failed: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (sourceFilter) params.set('source', sourceFilter)
      if (resultFilter) params.set('result', resultFilter)
      const { data } = await api.get(`/admin/postback-logs?${params}`)
      setLogs(data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load logs')
    } finally {
      setLoading(false)
    }
  }, [sourceFilter, resultFilter])

  useEffect(() => { load() }, [load])

  const okCount = logs.filter((l) => l.result === 'ok').length
  const errCount = logs.filter((l) => l.result === 'error').length
  const retryableCount = logs.filter((l) => l.result === 'error' && l.reason?.includes('logoUrl')).length

  async function retryFailed() {
    if (!confirm(`Retry ${retryableCount} failed postback(s)?`)) return
    setRetrying(true)
    setRetryResult(null)
    try {
      const { data } = await api.post('/admin/retry-failed-postbacks')
      setRetryResult(data)
      load()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Retry failed')
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Postback Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track all incoming postbacks and diagnose failures</p>
        </div>
        <div className="flex gap-2">
          {retryableCount > 0 && (
            <button onClick={retryFailed} disabled={retrying}
              className="text-sm bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 disabled:opacity-50">
              {retrying ? 'Retrying...' : `Retry Failed (${retryableCount})`}
            </button>
          )}
          <button onClick={load} disabled={loading}
            className="text-sm border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Total (last 100)</div>
          <div className="text-2xl font-bold text-gray-900">{logs.length}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Successful</div>
          <div className="text-2xl font-bold text-green-600">{okCount}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs text-gray-500 mb-1">Failed</div>
          <div className="text-2xl font-bold text-red-600">{errCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex gap-3">
        <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
          <option value="">All Sources</option>
          <option value="cityads">CityAds</option>
          <option value="appsflyer">AppsFlyer</option>
          <option value="adjust">Adjust</option>
        </select>
        <select value={resultFilter} onChange={(e) => setResultFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
          <option value="">All Results</option>
          <option value="ok">OK only</option>
          <option value="error">Errors only</option>
        </select>
      </div>

      {retryResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 text-green-700 text-sm">
          Retry complete: {retryResult.succeeded} succeeded, {retryResult.failed} failed (total: {retryResult.retried})
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-red-700 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                {['Time', 'Source', 'Result', 'Reason / XID', 'Publisher sa', 'Status', 'Details'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No postback logs yet</td></tr>
              ) : logs.map((log) => (
                <>
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtDate(log.receivedAt)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${SOURCE_COLORS[log.source] || 'bg-gray-100 text-gray-600'}`}>
                        {log.source}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {log.result === 'ok' ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">OK</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">ERROR</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {log.reason ? (
                        <span className="text-red-600 font-medium">{log.reason}</span>
                      ) : (
                        <span className="text-gray-400 font-mono">{log.xid || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-mono text-gray-500">
                      {log.rawQuery?.sa || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">{log.status || '—'}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                        {expanded === log.id ? 'Hide' : 'Raw'}
                      </button>
                    </td>
                  </tr>
                  {expanded === log.id && (
                    <tr key={`${log.id}-raw`} className="bg-gray-50">
                      <td colSpan={7} className="px-4 py-3">
                        <pre className="text-xs text-gray-700 whitespace-pre-wrap bg-white border border-gray-200 rounded-lg p-3 max-h-60 overflow-auto">
                          {JSON.stringify(log.rawQuery, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
