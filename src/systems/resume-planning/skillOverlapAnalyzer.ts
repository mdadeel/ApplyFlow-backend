export interface ScoredItem {
  id: string
  score: number
  matchedKeywords: string[]
}

export function analyzeSkillOverlap(
  items: { _id: any; technologies?: string[] }[],
  jdKeywords: string[],
): ScoredItem[] {
  const lowerKeywords = jdKeywords.map(k => k.toLowerCase())
  return items.map(item => {
    const techs = (item.technologies || []).map(t => t.toLowerCase())
    const matched = lowerKeywords.filter(k => techs.some(t => t.includes(k) || k.includes(t)))
    return {
      id: item._id,
      score: techs.length > 0 ? Math.round((matched.length / Math.max(techs.length, 1)) * 100) : 0,
      matchedKeywords: [...new Set(matched)],
    }
  }).sort((a, b) => b.score - a.score)
}
