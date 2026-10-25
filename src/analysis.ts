export type Video = { id: string; title: string; channel: string; category: string; publishedAt: string; durationMinutes: number; views: number; likes: number; comments: number; query: string; collectedAt: string }
const engagement = (video: Video) => video.views ? (video.likes + video.comments) / video.views * 100 : 0

export function analyze(videos: Video[]) {
  const analyzed = videos.map((video) => ({ ...video, engagementRate: engagement(video) }))
  const totalViews = analyzed.reduce((sum, video) => sum + video.views, 0)
  const averageEngagement = analyzed.reduce((sum, video) => sum + video.engagementRate, 0) / Math.max(analyzed.length, 1)
  const xMean = analyzed.reduce((sum, video) => sum + video.durationMinutes, 0) / Math.max(analyzed.length, 1)
  const numerator = analyzed.reduce((sum, video) => sum + (video.durationMinutes - xMean) * (video.engagementRate - averageEngagement), 0)
  const xSpread = Math.sqrt(analyzed.reduce((sum, video) => sum + (video.durationMinutes - xMean) ** 2, 0))
  const ySpread = Math.sqrt(analyzed.reduce((sum, video) => sum + (video.engagementRate - averageEngagement) ** 2, 0))
  const correlation = xSpread && ySpread ? numerator / (xSpread * ySpread) : 0
  const sortedByLength = [...analyzed].sort((a, b) => a.durationMinutes - b.durationMinutes)
  const groupCount = Math.min(5, sortedByLength.length)
  const buckets = Array.from({ length: groupCount }, (_, index) => {
    const start = Math.floor(index * sortedByLength.length / groupCount)
    const end = Math.floor((index + 1) * sortedByLength.length / groupCount)
    const matches = sortedByLength.slice(start, end)
    const shortest = matches[0]?.durationMinutes ?? 0
    const longest = matches.at(-1)?.durationMinutes ?? shortest
    return {
      label: `${shortest.toFixed(1)}–${longest.toFixed(1)} min`,
      videos: matches.length,
      engagementRate: matches.reduce((sum, video) => sum + video.engagementRate, 0) / Math.max(matches.length, 1),
    }
  })
  const categoryMap = new Map<string, number>()
  analyzed.forEach((video) => categoryMap.set(video.category || 'Uncategorized', (categoryMap.get(video.category || 'Uncategorized') || 0) + 1))
  const categoryData = [...categoryMap].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  return { videos: analyzed, count: analyzed.length, totalViews, averageEngagement, correlation, buckets, categoryData }
}
