import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import mongoose from 'mongoose'
import cookieParser from 'cookie-parser'
import { config } from './config'

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

// Health
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

import { errorHandler } from './middleware/errorHandler'

// Systems
import identityRoutes from './systems/identity/routes'
app.use('/api/auth', identityRoutes)

import careerDataRoutes from './systems/career-data/routes'
app.use('/api/profile', careerDataRoutes)

import jdRoutes from './systems/job-intelligence/routes'
app.use('/api/jd', jdRoutes)

import applicationRoutes from './systems/application-management/routes'
app.use('/api/applications', applicationRoutes)

import smartAppRoutes from './systems/smart-application/routes'
app.use('/api/v1/applications', smartAppRoutes)

import strategyRoutes from './systems/resume-planning/routes'
app.use('/api/strategy', strategyRoutes)

import resumeRoutes from './systems/resume-writing/routes'
app.use('/api/resume', resumeRoutes)

import contentRoutes from './systems/content-generation/routes'
app.use('/api/content', contentRoutes)

import validationRoutes from './systems/document-validation/routes'
app.use('/api/validate', validationRoutes)

import exportRoutes from './systems/export/routes'
app.use('/api/export', exportRoutes)

import exportPersistenceRoutes from './systems/export/persistence'
app.use('/api/exports', exportPersistenceRoutes)

import interviewRoutes from './systems/interview-intelligence/routes'
app.use('/api/interview', interviewRoutes)

import analyticsRoutes from './systems/analytics/routes'
app.use('/api/analytics', analyticsRoutes)

import learningRoutes from './systems/learning/routes'
app.use('/api/learning', learningRoutes)

import notificationRoutes from './systems/notifications/routes'
app.use('/api/notifications', notificationRoutes)

import communityRoutes from './systems/community/routes'
app.use('/api/v1/community', communityRoutes)

async function start() {
  try {
    await mongoose.connect(config.mongodbUri, { serverSelectionTimeoutMS: 3000 })
    console.log('Connected to MongoDB')
  } catch (err) {
    console.warn('MongoDB not available, running without database:', (err as Error).message)
  }

  const server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`)
  })
  // Increase timeout to 15 minutes to allow for long LLM generation requests
  server.timeout = 900000;
  server.keepAliveTimeout = 900000;
}

// Centralized error handler — must be registered AFTER all routes
app.use(errorHandler)

start()
