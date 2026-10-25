import cors from 'cors'
import express from 'express'
import pg from 'pg'

const app = express()
const port = Number(process.env.PORT || 3000)
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
app.use(cors())
app.use(express.json())

app.get('/api/health', async (_request, response) => {
  try { await pool.query('SELECT 1'); response.json({ status: 'ok' }) }
  catch { response.status(503).json({ status: 'database unavailable' }) }
})

app.get('/api/videos', async (_request, response, next) => {
  try {
    const { rows } = await pool.query(`SELECT id, title, channel, COALESCE(category, 'Uncategorized') AS category, published_at AS "publishedAt", duration_minutes AS "durationMinutes", views, likes, comments, query, collected_at AS "collectedAt" FROM videos ORDER BY views DESC`)
    response.json(rows.map((row) => ({ ...row, durationMinutes: Number(row.durationMinutes), views: Number(row.views), likes: Number(row.likes), comments: Number(row.comments) })))
  } catch (error) { next(error) }
})

app.post('/api/collect', async (request, response, next) => {
  try {
    const key = process.env.YOUTUBE_API_KEY
    if (!key) return response.status(503).json({ error: 'YOUTUBE_API_KEY is not configured' })
    const query = String(request.body.query || '').trim()
    const count = Math.min(Math.max(Number(request.body.count || 500), 1), 500)
    if (!query) return response.status(400).json({ error: 'A search topic is required' })

    const ids = []
    let pageToken
    while (ids.length < count) {
      const params = { key, part: 'snippet', type: 'video', q: query, maxResults: String(Math.min(50, count - ids.length)), order: 'relevance' }
      if (pageToken) params.pageToken = pageToken
      const page = await youtubeRequest(youtubeUrl('search', params))
      ids.push(...page.items.map((item) => item.id.videoId).filter(Boolean))
      pageToken = page.nextPageToken
      if (!pageToken) break
    }

    if (!ids.length) return response.json({ collected: 0 })
    const categoryResponse = await youtubeRequest(youtubeUrl('videoCategories', { key, part: 'snippet', regionCode: 'US' }))
    const categories = new Map(categoryResponse.items.map((item) => [item.id, item.snippet.title]))
    const videos = []
    for (let start = 0; start < ids.length; start += 50) {
      const batch = await youtubeRequest(youtubeUrl('videos', { key, part: 'snippet,contentDetails,statistics', id: ids.slice(start, start + 50).join(',') }))
      videos.push(...batch.items)
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const item of videos) {
        const categoryId = item.snippet.categoryId
        await client.query(`INSERT INTO videos (id, title, channel, category_id, category, published_at, duration_minutes, views, likes, comments, query, collected_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
          ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, channel=EXCLUDED.channel, category_id=EXCLUDED.category_id, category=EXCLUDED.category, published_at=EXCLUDED.published_at, duration_minutes=EXCLUDED.duration_minutes, views=EXCLUDED.views, likes=EXCLUDED.likes, comments=EXCLUDED.comments, query=EXCLUDED.query, collected_at=NOW()`,
          [item.id, item.snippet.title, item.snippet.channelTitle, categoryId, categories.get(categoryId) || 'Uncategorized', item.snippet.publishedAt, isoDurationToMinutes(item.contentDetails.duration), Number(item.statistics.viewCount || 0), Number(item.statistics.likeCount || 0), Number(item.statistics.commentCount || 0), query])
      }
      await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
    response.json({ collected: videos.length })
  } catch (error) { next(error) }
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ error: error.message || 'Unexpected server error' })
})

async function start() {
  await pool.query('ALTER TABLE videos ADD COLUMN IF NOT EXISTS category_id TEXT')
  await pool.query('ALTER TABLE videos ADD COLUMN IF NOT EXISTS category TEXT')
  app.listen(port, () => console.log(`API listening on port ${port}`))
}
start().catch((error) => { console.error(error); process.exit(1) })

function youtubeUrl(endpoint, params) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`)
  url.search = new URLSearchParams(params).toString()
  return url
}

async function youtubeRequest(url) {
  const result = await fetch(url)
  if (!result.ok) throw new Error(`YouTube API failed (${result.status}): ${await result.text()}`)
  return result.json()
}

function isoDurationToMinutes(value) {
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/)
  return match ? Number(match[1] || 0) * 60 + Number(match[2] || 0) + Number(match[3] || 0) / 60 : 0
}
