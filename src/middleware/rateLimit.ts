import rateLimit from 'express-rate-limit'

/**
 * General rate limiter: 100 requests per 15 minutes per IP
 */
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * Auth write limiter: 10 requests per 15 minutes per IP
 * Only for sensitive write operations (login, register, dev-login)
 */
export const authWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    error: 'Too many login attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * AI rate limiter: 30 requests per hour per IP
 * Controls cost of AI API calls across all AI-consuming endpoints
 */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  message: {
    error: 'AI request limit reached. Upgrade for more requests.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * Apify scraper limiter: 3 requests per hour per IP
 * Each trigger starts an Apify actor run that costs credits — must be tightly gated.
 */
export const apifyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    error: 'Job scrape limit reached. Please wait before triggering another search.',
  },
  standardHeaders: true,
  legacyHeaders: false,
})
