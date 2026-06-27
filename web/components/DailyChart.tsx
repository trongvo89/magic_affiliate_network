'use client'
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

interface DailyData {
  date: string
  [key: string]: string | number
}

interface ChartLine {
  key: string
  color: string
  label: string
}

export function PerformanceChart({ data, lines }: { data: DailyData[]; lines: ChartLine[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          labelFormatter={d => new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        {lines.map(l => (
          <Area key={l.key} type="monotone" dataKey={l.key} name={l.label}
            stroke={l.color} fill={l.color} fillOpacity={0.1} strokeWidth={2} dot={false} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function CommissionChart({ data, dataKey, label, color }: { data: DailyData[]; dataKey: string; label: string; color: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} stroke="#94a3b8" />
        <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          labelFormatter={d => new Date(d + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
        <Bar dataKey={dataKey} name={label} fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
