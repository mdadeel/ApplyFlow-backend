import { PipelineMetrics, pipelineMetrics, DEFAULT_WINDOW_SIZE } from '../metrics'

describe('PipelineMetrics', () => {
  beforeEach(() => {
    pipelineMetrics.reset()
  })

  it('starts empty', () => {
    expect(pipelineMetrics.size).toBe(0)
    expect(pipelineMetrics.getAll()).toEqual({})
  })

  it('records a single run', () => {
    pipelineMetrics.record({
      stage: 'generate',
      latency: 100,
      passed: true,
      retryCount: 1,
      score: 85,
      timestamp: Date.now(),
    })

    expect(pipelineMetrics.size).toBe(1)
    const all = pipelineMetrics.getAll()
    expect(all.generate).toBeDefined()
    expect(all.generate.totalRuns).toBe(1)
    expect(all.generate.avgLatency).toBe(100)
    expect(all.generate.passCount).toBe(1)
    expect(all.generate.failCount).toBe(0)
    expect(all.generate.avgRetryCount).toBe(1)
    expect(all.generate.avgScore).toBe(85)
  })

  it('records multiple runs of the same stage', () => {
    for (let i = 0; i < 3; i++) {
      pipelineMetrics.record({
        stage: 'generate',
        latency: 100,
        passed: i < 2,
        retryCount: 1,
        score: 80 + i * 5,
        timestamp: Date.now(),
      })
    }

    const all = pipelineMetrics.getAll()
    expect(all.generate.totalRuns).toBe(3)
    expect(all.generate.passCount).toBe(2)
    expect(all.generate.failCount).toBe(1)
    expect(all.generate.avgScore).toBe(85)
  })

  it('records multiple stages independently', () => {
    pipelineMetrics.record({ stage: 'generate', latency: 200, passed: true, retryCount: 2, score: 90, timestamp: Date.now() })
    pipelineMetrics.record({ stage: 'truth_gate', latency: 50, passed: true, retryCount: 1, score: 95, timestamp: Date.now() })
    pipelineMetrics.record({ stage: 'ats_fill', latency: 300, passed: false, retryCount: 3, score: 55, timestamp: Date.now() })

    const all = pipelineMetrics.getAll()
    expect(Object.keys(all)).toHaveLength(3)
    expect(all.generate.totalRuns).toBe(1)
    expect(all.truth_gate.totalRuns).toBe(1)
    expect(all.ats_fill.totalRuns).toBe(1)
  })

  it('enforces rolling window size limit', () => {
    const smallMetrics = new PipelineMetrics(3)
    for (let i = 0; i < 5; i++) {
      smallMetrics.record({
        stage: 'generate',
        latency: 100,
        passed: true,
        retryCount: 1,
        score: 85,
        timestamp: Date.now(),
      })
    }
    expect(smallMetrics.size).toBe(3)
  })

  it('getRaw returns a copy of all records', () => {
    pipelineMetrics.record({ stage: 'test', latency: 10, passed: true, retryCount: 1, score: 100, timestamp: Date.now() })
    const raw = pipelineMetrics.getRaw()
    expect(raw).toHaveLength(1)
    expect(raw[0].stage).toBe('test')

    // Modifying raw should not affect internal state
    raw.push({ stage: 'injected', latency: 0, passed: true, retryCount: 0, score: 0, timestamp: 0 })
    expect(pipelineMetrics.size).toBe(1)
  })

  it('default window size is 1000', () => {
    expect(DEFAULT_WINDOW_SIZE).toBe(1000)
  })
})
