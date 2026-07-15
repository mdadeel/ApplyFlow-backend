import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import mongoose from 'mongoose'
import cookieParser from 'cookie-parser'
import morgan from 'morgan'
import { config } from './config'
import { generalLimiter, authWriteLimiter, aiLimiter } from './middleware/rateLimit'
import { logger } from './utils/logger'
import { csrfProtection } from './middleware/csrf'
import { errorHandler } from './middleware/errorHandler'
import docsRouter from './docs/swagger'

import identityRoutes from './systems/identity/routes'
import careerDataRoutes from './systems/career-data/routes'
import jdRoutes from './systems/job-intelligence/routes'
import applicationRoutes from './systems/application-management/routes'
import smartAppRoutes from './systems/smart-application/routes'
import strategyRoutes from './systems/resume-planning/routes'
import resumeRoutes from './systems/resume-writing/routes'
import contentRoutes from './systems/content-generation/routes'
import validationRoutes from './systems/document-validation/routes'
import exportRoutes from './systems/export/routes'
import exportPersistenceRoutes from './systems/export/persistence'
import interviewRoutes from './systems/interview-intelligence/routes'
import analyticsRoutes from './systems/analytics/routes'
import learningRoutes from './systems/learning/routes'
import notificationRoutes from './systems/notifications/routes'
import communityRoutes from './systems/community/routes'
import discussionRoutes from './systems/discussion/routes'
import opportunityRoutes from './systems/opportunity/routes'
import contributionRoutes from './systems/contribution/routes'
import workspaceRoutes from './systems/workspace/routes'
import recommenderRoutes from './systems/recommender/routes'
import communityAnalyticsRoutes from './systems/community-analytics/routes'
import reputationRoutes from './systems/reputation/routes'
import engineHealthRoutes from './engine/observability/index'
import engineLearningRoutes from './engine/learning/routes'

import { start as startIngestionWorker } from './workers/opportunity-ingestion'
import { start as startEmbeddingWorker } from './workers/embedding-refresh'
import { start as startMatchWorker } from './workers/match-refresh'
import { start as startDeadlineWorker } from './workers/deadline-alert'

const app = express()

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
}))
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())

// Morgan HTTP request logging — streams into winston
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: {
    write: (message: string) => logger.http(message.trim()),
  },
  skip: (req, res) => {
    // Skip health check noise in production
    if (process.env.NODE_ENV === 'production' && req.path === '/api/health') {
      return res.statusCode < 400
    }
    return false
  },
}))

// Swagger UI & API docs
app.use(docsRouter)

// Rate limiting — applied BEFORE routes
app.use('/api/auth/login', authWriteLimiter)
app.use('/api/auth/register', authWriteLimiter)
app.use('/api/auth/dev-login', authWriteLimiter)
app.use('/api/jd', aiLimiter)
app.use('/api/resume', aiLimiter)
app.use('/api/content', aiLimiter)
app.use('/api/strategy', aiLimiter)
app.use('/api/interview', aiLimiter)
app.use('/api/v1/engine/health', aiLimiter)
app.use('/api/v1/applications', aiLimiter)
app.use(generalLimiter)

// CSRF protection — applied BEFORE all state-changing API routes
app.use('/api', csrfProtection)

// Health
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Systems
app.use('/api/auth', identityRoutes)
app.use('/api/profile', careerDataRoutes)
app.use('/api/jd', jdRoutes)
app.use('/api/applications', applicationRoutes)
app.use('/api/v1/applications', smartAppRoutes)
app.use('/api/strategy', strategyRoutes)
app.use('/api/resume', resumeRoutes)
app.use('/api/content', contentRoutes)
app.use('/api/validate', validationRoutes)
app.use('/api/export', exportRoutes)
app.use('/api/exports', exportPersistenceRoutes)
app.use('/api/interview', interviewRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/learning', learningRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/v1/community', communityRoutes)
app.use('/api/discussions', discussionRoutes)
app.use('/api/opportunities', opportunityRoutes)
app.use('/api/opportunities/:opportunityId/contributions', contributionRoutes)
app.use('/api/workspaces', workspaceRoutes)
app.use('/api', recommenderRoutes)
app.use('/api/analytics/community', communityAnalyticsRoutes)
app.use('/api', reputationRoutes)

// Engine (observability + learning)
app.use('/api/v1/engine', engineHealthRoutes)
app.use('/api/v1/engine/learning', engineLearningRoutes)

// Centralized error handler — must be registered AFTER all routes
app.use(errorHandler)

let dbConnected = false

async function start() {
  try {
    await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 3000 })
    dbConnected = true
    console.log('Connected to MongoDB')
  } catch (err) {
    console.warn('MongoDB not available, running without database:', (err as Error).message)
  }

  const server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`)
    if (dbConnected) {
      startIngestionWorker()
      startEmbeddingWorker()
      startMatchWorker()
      startDeadlineWorker()
      console.log('Background workers started')
    } else {
      console.log('Skipping background workers — no database connection')
    }
  })
  // Increase timeout to 15 minutes to allow for long LLM generation requests
  server.timeout = 900000;
  server.keepAliveTimeout = 900000;
}

start()
