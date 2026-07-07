import { createStageLogger } from '../logger'

describe('createStageLogger', () => {
  let consoleLogMock: jest.SpyInstance
  let consoleErrorMock: jest.SpyInstance

  beforeEach(() => {
    consoleLogMock = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogMock.mockRestore()
    consoleErrorMock.mockRestore()
  })

  it('returns a logger with info/warn/error methods', () => {
    const log = createStageLogger('test')
    expect(log).toHaveProperty('info')
    expect(log).toHaveProperty('warn')
    expect(log).toHaveProperty('error')
    expect(typeof log.info).toBe('function')
    expect(typeof log.warn).toBe('function')
    expect(typeof log.error).toBe('function')
  })

  it('logs info via console.log', () => {
    const log = createStageLogger('test')
    log.info('test_op', { score: 95 })
    expect(consoleLogMock).toHaveBeenCalled()
    const output = JSON.parse(consoleLogMock.mock.calls[0][0])
    expect(output.stage).toBe('test')
    expect(output.operation).toBe('test_op')
    expect(output.level).toBe('info')
    expect(output.data.score).toBe(95)
  })

  it('logs error via console.error', () => {
    const log = createStageLogger('test')
    log.error('err_op', { error: 'something broke' })
    expect(consoleErrorMock).toHaveBeenCalled()
    const output = JSON.parse(consoleErrorMock.mock.calls[0][0])
    expect(output.level).toBe('error')
  })

  it('handles empty data', () => {
    const log = createStageLogger('test')
    log.info('no_data')
    expect(consoleLogMock).toHaveBeenCalled()
    const output = JSON.parse(consoleLogMock.mock.calls[0][0])
    expect(output.data).toEqual({})
  })

  it('redacts PII email from output', () => {
    const log = createStageLogger('test')
    log.info('with_email', { email: 'test@example.com', score: 85 })
    expect(consoleLogMock).toHaveBeenCalled()
    const output = JSON.parse(consoleLogMock.mock.calls[0][0])
    // The field key is preserved but the value should be redacted
    expect(output.data.email).not.toBe('test@example.com')
  })

  it('redacts PII phone from output', () => {
    const log = createStageLogger('test')
    log.info('with_phone', { phone: '555-123-4567', score: 85 })
    expect(consoleLogMock).toHaveBeenCalled()
    const output = JSON.parse(consoleLogMock.mock.calls[0][0])
    expect(output.data.phone).not.toBe('555-123-4567')
  })

  it('preserves allowed fields like score and latency', () => {
    const log = createStageLogger('test')
    log.info('allowed', { score: 85, latency: 100, retryCount: 2 })
    expect(consoleLogMock).toHaveBeenCalled()
    const output = JSON.parse(consoleLogMock.mock.calls[0][0])
    expect(output.data.score).toBe(85)
    expect(output.data.latency).toBe(100)
    expect(output.data.retryCount).toBe(2)
  })

  it('includes stage name in every log line', () => {
    const log = createStageLogger('my-stage')
    log.info('test')
    const output = JSON.parse(consoleLogMock.mock.calls[0][0])
    expect(output.stage).toBe('my-stage')
  })

  it('includes a timestamp per log line', () => {
    const log = createStageLogger('test')
    log.info('timed')
    const output = JSON.parse(consoleLogMock.mock.calls[0][0])
    expect(output.timestamp).toBeDefined()
    expect(typeof output.timestamp).toBe('string')
    // Timestamp should be an ISO date string
    expect(new Date(output.timestamp).toISOString()).toBe(output.timestamp)
  })
})
