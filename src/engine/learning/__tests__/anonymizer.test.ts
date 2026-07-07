import { anonymizeRecord, anonymizeText } from '../anonymizer'

describe('anonymizeRecord', () => {
  it('hashes userId field', () => {
    const result = anonymizeRecord({ userId: 'user-123', score: 85 })
    expect(result).not.toHaveProperty('userId')
    expect(result).toHaveProperty('_userId')
    expect(typeof (result as any)._userId).toBe('string')
    // Hash should be consistent
    const result2 = anonymizeRecord({ userId: 'user-123' })
    expect((result as any)._userId).toBe((result2 as any)._userId)
  })

  it('drops email and phone fields entirely', () => {
    const result = anonymizeRecord({
      email: 'test@example.com',
      phone: '555-123-4567',
      score: 85,
    })
    expect(result).not.toHaveProperty('email')
    expect(result).not.toHaveProperty('phone')
    expect(result).toHaveProperty('score')
  })

  it('preserves non-PII fields', () => {
    const result = anonymizeRecord({
      score: 95,
      latency: 100,
      passed: true,
      stage: 'generate',
    })
    expect(result.score).toBe(95)
    expect(result.latency).toBe(100)
    expect(result.passed).toBe(true)
  })

  it('replaces company names with [COMPANY]', () => {
    const result = anonymizeRecord({
      company: 'Acme Corp',
      stage: 'generate',
    })
    expect(result.company).toBe('[COMPANY]')
  })

  it('recursively anonymizes nested objects', () => {
    const result = anonymizeRecord({
      metadata: {
        email: 'nested@example.com',
        score: 90,
      },
    })
    expect((result.metadata as any).email).toBeUndefined()
    expect((result.metadata as any).score).toBe(90)
  })

  it('handles empty objects', () => {
    const result = anonymizeRecord({})
    expect(result).toEqual({})
  })
})

describe('anonymizeText', () => {
  it('replaces email addresses', () => {
    const result = anonymizeText('Contact me at john@example.com')
    expect(result).toContain('[EMAIL]')
    expect(result).not.toContain('john@example.com')
  })

  it('replaces phone numbers', () => {
    const result = anonymizeText('Call me at 555-123-4567')
    expect(result).toContain('[PHONE]')
    expect(result).not.toContain('555-123-4567')
  })

  it('replaces company names', () => {
    const result = anonymizeText('Worked at Acme Corp for 5 years')
    expect(result).toContain('[COMPANY]')
    expect(result).not.toContain('Acme Corp')
  })

  it('replaces LinkedIn URLs', () => {
    const result = anonymizeText('linkedin.com/in/johndoe')
    expect(result).toContain('[LINKEDIN]')
  })

  it('replaces GitHub URLs', () => {
    const result = anonymizeText('github.com/johndoe')
    expect(result).toContain('[GITHUB]')
  })

  it('preserves non-PII text', () => {
    const result = anonymizeText('Built React components with TypeScript')
    expect(result).toBe('Built React components with TypeScript')
  })

  it('handles empty strings', () => {
    expect(anonymizeText('')).toBe('')
  })
})
