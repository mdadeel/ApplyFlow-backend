import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/applyflow',
  jwtSecret: process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-production',
  jwtExpiresIn: '7d',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  githubClientId: process.env.GITHUB_CLIENT_ID,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
  linkedinClientId: process.env.LINKEDIN_CLIENT_ID,
  linkedinClientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  aiProvider: process.env.AI_PROVIDER || 'openai',
  aiApiKey: process.env.AI_API_KEY,
  aiModel: process.env.AI_MODEL || 'gpt-4o-mini',
  aiTemperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
  aiBaseUrl: process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1',
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'qwen2.5:3b',
  // Email
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFrom: process.env.RESEND_FROM || 'noreply@applyflow.ai',
  // Apify job scraper
  apifyApiToken: process.env.APIFY_API_TOKEN || '',
}
