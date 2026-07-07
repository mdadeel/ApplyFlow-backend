import { FeedbackAggregator, feedbackAggregator } from '../feedbackAggregator'

describe('FeedbackAggregator', () => {
  beforeEach(() => {
    feedbackAggregator.clear()
  })

  it('starts empty', () => {
    expect(feedbackAggregator.size).toBe(0)
  })

  it('records a feedback event', () => {
    feedbackAggregator.record({
      userId: 'user-1',
      timestamp: Date.now(),
      source: 'explicit-rating',
      phase: 'generate',
      original: 'original content',
      score: 85,
      rating: 'up',
    })

    expect(feedbackAggregator.size).toBe(1)
    const all = feedbackAggregator.getAll()
    expect(all[0].source).toBe('explicit-rating')
    expect(all[0].rating).toBe('up')
  })

  it('computes diff for export-edit events', () => {
    feedbackAggregator.record({
      userId: 'user-1',
      timestamp: Date.now(),
      source: 'export-edit',
      phase: 'generate',
      original: 'line one\nline two\nline three',
      edited: 'line one\nline two modified\nline three',
      score: 80,
      section: 'experience',
    })

    const events = feedbackAggregator.getBySource('export-edit')
    expect(events).toHaveLength(1)
    expect(events[0].diff).toBeDefined()
    expect(events[0].diff).toContain('→') // contains a change arrow
  })

  it('filters by source', () => {
    feedbackAggregator.record({ userId: 'u1', timestamp: 1, source: 'explicit-rating', phase: 'gen', original: 'a', score: 80, rating: 'up' })
    feedbackAggregator.record({ userId: 'u1', timestamp: 2, source: 'regeneration', phase: 'gen', original: 'b', score: 60, section: 'summary' })
    feedbackAggregator.record({ userId: 'u1', timestamp: 3, source: 'validation-override', phase: 'truth_gate', original: 'c', score: 40 })

    expect(feedbackAggregator.getBySource('regeneration')).toHaveLength(1)
    expect(feedbackAggregator.getBySource('explicit-rating')).toHaveLength(1)
    expect(feedbackAggregator.getBySource('validation-override')).toHaveLength(1)
  })

  it('filters by phase', () => {
    feedbackAggregator.record({ userId: 'u1', timestamp: 1, source: 'regeneration', phase: 'generate', original: 'a', score: 80 })
    feedbackAggregator.record({ userId: 'u1', timestamp: 2, source: 'regeneration', phase: 'humanization', original: 'b', score: 70 })

    expect(feedbackAggregator.getByPhase('generate')).toHaveLength(1)
    expect(feedbackAggregator.getByPhase('humanization')).toHaveLength(1)
  })

  it('enforces size limit', () => {
    const small = new FeedbackAggregator(3)
    for (let i = 0; i < 5; i++) {
      small.record({ userId: 'u1', timestamp: i, source: 'explicit-rating', phase: 'gen', original: `${i}`, score: 80, rating: 'down' })
    }
    expect(small.size).toBe(3)
  })

  it('getRecent returns last N events in order', () => {
    for (let i = 0; i < 10; i++) {
      feedbackAggregator.record({ userId: 'u1', timestamp: i, source: 'explicit-rating', phase: 'gen', original: `${i}`, score: 80 })
    }
    const recent = feedbackAggregator.getRecent(3)
    expect(recent).toHaveLength(3)
    // Most recent are at the end
    expect(recent[2].original).toBe('9')
  })
})
