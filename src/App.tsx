import { FormEvent, useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { analyze, type Video } from './analysis'

const number = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const chalkColors = ['#dfc982', '#c8bda7', '#9caaa3', '#b7a996', '#d8d2c2', '#7f918a', '#a7a29a', '#ede7d5']

export function App() {
  const [videos, setVideos] = useState<Video[]>([])
  const [query, setQuery] = useState('education')
  const [status, setStatus] = useState('Loading saved videos…')
  const [busy, setBusy] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const absoluteMax = Math.max(10, Math.ceil(Math.max(0, ...videos.map((video) => video.durationMinutes))))
  const [minLength, setMinLength] = useState(0)
  const [maxLength, setMaxLength] = useState(180)
  const lengthFiltered = useMemo(() => videos.filter((video) => video.durationMinutes >= minLength && video.durationMinutes <= maxLength), [videos, minLength, maxLength])
  const filtered = useMemo(() => lengthFiltered.filter((video) =>
    !selectedCategories.length || selectedCategories.includes(video.category || 'Uncategorized'),
  ), [lengthFiltered, selectedCategories])
  const result = useMemo(() => analyze(filtered), [filtered])
  const categoryDistribution = useMemo(() => analyze(lengthFiltered).categoryData, [lengthFiltered])
  const uniqueChannels = useMemo(() => new Set(filtered.map((video) => video.channel)).size, [filtered])

  async function loadVideos() {
    const response = await fetch('/api/videos')
    if (!response.ok) throw new Error('Could not load saved videos')
    const data = await response.json()
    setVideos(data)
    const longest = Math.max(10, Math.ceil(Math.max(0, ...data.map((video: Video) => video.durationMinutes))))
    setMaxLength(longest)
    setStatus(data.length ? `${data.length} saved videos` : 'No videos yet—collect a topic to begin')
  }

  useEffect(() => { loadVideos().catch((error) => setStatus(error.message)) }, [])

  async function collect(event: FormEvent) {
    event.preventDefault(); setBusy(true); setStatus('Collecting up to 500 videos from YouTube. This can take a minute…')
    try {
      const response = await fetch('/api/collect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, count: 500 }) })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'Collection failed')
      await loadVideos(); setStatus(`Collected ${body.collected} videos for “${query}”`)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Collection failed') }
    finally { setBusy(false) }
  }

  function toggleCategory(category: string) {
    setSelectedCategories((current) => current[0] === category ? [] : [category])
  }

  return <main>
    <header><div><span className="eyebrow">EDUTUBE RESEARCH BOARD</span><h1>Video engagement analysis</h1><p>Collect a broad learning dataset, then explore how length and category relate to engagement.</p></div><span className="chalk-mark">500</span></header>
    <form className="collector" onSubmit={collect}><label htmlFor="topic">YouTube search topic</label><div><input id="topic" value={query} onChange={(event) => setQuery(event.target.value)} required /><button disabled={busy}>{busy ? 'Collecting…' : 'Collect up to 500 videos'}</button></div><small aria-live="polite">{status}</small></form>

    {videos.length > 0 ? <>
      <section className="filters card"><div className="filter-head"><div><h2>Filter the board</h2><p>Use the duration controls here and the category pie chart below.</p></div><button className="clear" onClick={() => { setSelectedCategories([]); setMinLength(0); setMaxLength(absoluteMax) }}>Clear filters</button></div><div className="range-grid"><label>Minimum length <strong>{minLength} min</strong><input type="range" min="0" max={absoluteMax} value={minLength} onChange={(event) => setMinLength(Math.min(Number(event.target.value), maxLength))} /></label><label>Maximum length <strong>{maxLength} min</strong><input type="range" min="0" max={absoluteMax} value={maxLength} onChange={(event) => setMaxLength(Math.max(Number(event.target.value), minLength))} /></label></div></section>
      <section className="metrics"><Metric label="Videos shown" value={String(result.count)} /><Metric label="Unique channels" value={String(uniqueChannels)} note={`${result.count ? Math.round(uniqueChannels / result.count * 100) : 0}% channel spread`} /><Metric label="Total views" value={number.format(result.totalViews)} /><Metric label="Average engagement" value={`${result.averageEngagement.toFixed(2)}%`} /><Metric label="Length correlation" value={result.correlation.toFixed(2)} note="-1 negative · +1 positive" /></section>
      {filtered.length ? <>
        <section className="charts">
          <ChartCard title="Duration vs. engagement" subtitle="Each chalk point is one saved video."><ResponsiveContainer width="100%" height={320}><ScatterChart margin={{ top: 20, right: 20, bottom: 15, left: 5 }}><CartesianGrid stroke="#839089" strokeDasharray="4 5" /><XAxis type="number" dataKey="durationMinutes" name="Duration" unit=" min" stroke="#cbd0ca" /><YAxis type="number" dataKey="engagementRate" name="Engagement" unit="%" stroke="#cbd0ca" /><Tooltip contentStyle={{ background: '#293a35', border: '1px solid #839089', color: '#f2efe2' }} /><Scatter data={result.videos} fill="#dfc982" /></ScatterChart></ResponsiveContainer></ChartCard>
          <ChartCard title="Filter by category" subtitle={selectedCategories.length ? `Selected: ${selectedCategories[0]}. Choose another slice to replace it, or click it again to clear.` : 'Click a slice to filter the entire board to one category.'}><ResponsiveContainer width="100%" height={320}><PieChart><Pie data={categoryDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2} onClick={(entry) => entry.name && toggleCategory(String(entry.name))} className="category-pie">{categoryDistribution.map((item, index) => <Cell key={item.name} fill={chalkColors[index % chalkColors.length]} opacity={!selectedCategories.length || selectedCategories.includes(item.name) ? 1 : 0.28} stroke={selectedCategories.includes(item.name) ? '#f2efe2' : '#293a35'} strokeWidth={selectedCategories.includes(item.name) ? 3 : 1} />)}</Pie><Tooltip contentStyle={{ background: '#293a35', border: '1px solid #839089', color: '#f2efe2' }} /><Legend wrapperStyle={{ color: '#f2efe2', fontSize: 11 }} /></PieChart></ResponsiveContainer></ChartCard>
          <ChartCard title="Engagement across 5 length groups" subtitle="Videos are dynamically divided into five equally populated groups from shortest to longest."><ResponsiveContainer width="100%" height={320}><BarChart data={result.buckets} margin={{ top: 20, right: 15, bottom: 15, left: 0 }}><CartesianGrid stroke="#839089" strokeDasharray="4 5" vertical={false} /><XAxis dataKey="label" stroke="#cbd0ca" /><YAxis unit="%" stroke="#cbd0ca" /><Tooltip contentStyle={{ background: '#293a35', border: '1px solid #839089', color: '#f2efe2' }} formatter={(value, name, item) => [`${Number(value).toFixed(2)}% (${item.payload.videos} videos)`, name]} /><Bar dataKey="engagementRate" name="Average engagement" fill="#c8bda7" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>
        </section>
        <section className="card table-card"><h2>Saved videos</h2><p>Showing {result.count} filtered records.</p><div className="table-wrap"><table><thead><tr><th>Video</th><th>Category</th><th>Duration</th><th>Views</th><th>Engagement</th></tr></thead><tbody>{result.videos.map((video) => <tr key={video.id}><td><a href={`https://youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer">{video.title}</a><small>{video.channel}</small></td><td>{video.category}</td><td>{video.durationMinutes.toFixed(1)} min</td><td>{number.format(video.views)}</td><td>{video.engagementRate.toFixed(2)}%</td></tr>)}</tbody></table></div></section>
      </> : <section className="empty"><h2>No videos match these filters</h2><p>Clear a category or widen the duration range.</p></section>}
    </> : <section className="empty"><h2>Your analysis will appear here</h2><p>Enter a topic above to collect the first dataset.</p></section>}
  </main>
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) { return <article><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</article> }
function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) { return <article className="card chart-card"><h2>{title}</h2><p>{subtitle}</p>{children}</article> }
