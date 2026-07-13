import { Router } from 'express'
import swaggerUi from 'swagger-ui-express'
import { config } from '../config'

const swaggerSpec = {
  openapi: '3.0.3',
    info: {
      title: 'ApplyFlow AI API',
      version: '0.1.0',
      description: `**Your Intelligent Job Application OS**

ApplyFlow AI streamlines job searches with AI-powered resume tailoring, intelligent job matching, automated application tracking, and community collaboration.

## Authentication

All API endpoints (except auth & health) require a valid session cookie:
- **Cookie**: \`af_session\` (httpOnly JWT, set on login/register)
- **CSRF**: State-changing requests (POST, PUT, DELETE) require \`X-CSRF-Token\` header matching the \`af_csrf\` cookie

## Base URL

Development: \`http://localhost:5000/api\`
Production: \`https://api.applyflow.ai/api\`
`,
      contact: {
        email: 'support@applyflow.ai',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
    ],
    tags: [
      { name: 'Health', description: 'Server health and monitoring' },
      { name: 'Auth', description: 'Authentication & user management' },
      { name: 'Profile', description: 'Career profile management (experience, education, skills, etc.)' },
      { name: 'Applications', description: 'Job application tracking & management' },
      { name: 'Smart Application', description: 'AI-powered smart application assistant' },
      { name: 'Job Analysis', description: 'Job description analysis & matching' },
      { name: 'Resume', description: 'Resume generation, planning & editing' },
      { name: 'Content', description: 'AI content generation' },
      { name: 'Validation', description: 'Document validation & scoring' },
      { name: 'Export', description: 'Export resumes and documents' },
      { name: 'Interview', description: 'Interview preparation & practice' },
      { name: 'Analytics', description: 'Application analytics & insights' },
      { name: 'Learning', description: 'Admin learning content management' },
      { name: 'Notifications', description: 'User notifications' },
      { name: 'Community', description: 'Community features (feed, discussions, opportunities, referrals)' },
      { name: 'Workspace', description: 'Collaborative workspaces' },
      { name: 'Observability', description: 'Engine observability & learning feedback' },
    ],
    components: {
      securitySchemes: {
        SessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'af_session',
          description: 'JWT session cookie set on login/register',
        },
        CsrfToken: {
          type: 'apiKey',
          in: 'header',
          name: 'X-CSRF-Token',
          description: 'CSRF protection token (required for POST, PUT, DELETE). Read from the `af_csrf` cookie.',
        },
      },
      schemas: {
        // ── Core ──────────────────────────────────────────────────────
        Error: {
          type: 'object',
          required: ['error'],
          properties: {
            error: { type: 'string', example: 'Invalid email or password' },
            details: { type: 'array', items: { type: 'object' }, description: 'Validation error details (optional)' },
          },
        },
        Success: {
          type: 'object',
          properties: {
            data: { description: 'Success payload (varies by endpoint)' },
          },
        },

        // ── Auth ──────────────────────────────────────────────────────
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            password: { type: 'string', format: 'password', example: 'mypassword123' },
          },
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'name'],
          properties: {
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            password: { type: 'string', format: 'password', example: 'mypassword123' },
            name: { type: 'string', example: 'John Doe' },
          },
        },
        User: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: '507f1f77bcf86cd799439011' },
            email: { type: 'string', example: 'user@example.com' },
            name: { type: 'string', example: 'John Doe' },
            authProvider: { type: 'string', enum: ['email', 'google', 'github', 'linkedin'] },
            onboardingComplete: { type: 'boolean' },
            preferences: { '$ref': '#/components/schemas/UserPreferences' },
            isVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        UserPreferences: {
          type: 'object',
          properties: {
            aiProvider: { type: 'string', enum: ['openai', 'anthropic', 'gemini', 'ollama'], example: 'openai' },
            model: { type: 'string', example: 'gpt-4o-mini' },
            temperature: { type: 'number', format: 'float', example: 0.7 },
            writingTone: { type: 'string', enum: ['professional', 'concise', 'technical', 'recruiter-focused'] },
            defaultTemplate: { type: 'string', enum: ['minimal', 'modern', 'ats', 'academic', 'creative'] },
            defaultExportFormat: { type: 'string', enum: ['pdf', 'docx', 'md'] },
            notifications: {
              type: 'object',
              properties: {
                applicationUpdates: { type: 'boolean' },
                interviewReminders: { type: 'boolean' },
                newFeatures: { type: 'boolean' },
                weeklyDigest: { type: 'boolean' },
                marketingEmails: { type: 'boolean' },
              },
            },
          },
        },
        ChangePasswordRequest: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string', format: 'password' },
            newPassword: { type: 'string', format: 'password', minLength: 6 },
          },
        },
        ForgotPasswordRequest: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
        ResetPasswordRequest: {
          type: 'object',
          required: ['token', 'newPassword'],
          properties: {
            token: { type: 'string', description: 'Reset token from email' },
            newPassword: { type: 'string', format: 'password', minLength: 6 },
          },
        },
        VerifyEmailRequest: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string', description: 'Verification token from email' },
          },
        },
        GoogleAuthRequest: {
          type: 'object',
          required: ['accessToken'],
          properties: {
            accessToken: { type: 'string', description: 'Google OAuth access token' },
          },
        },
        GithubAuthRequest: {
          type: 'object',
          required: ['code'],
          properties: {
            code: { type: 'string', description: 'GitHub OAuth authorization code' },
          },
        },
        SaveApiKeyRequest: {
          type: 'object',
          required: ['provider', 'key'],
          properties: {
            provider: { type: 'string', example: 'openai' },
            key: { type: 'string', format: 'password' },
          },
        },

        // ── Profile / Career Data ─────────────────────────────────────
        Experience: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            company: { type: 'string' },
            role: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            current: { type: 'boolean' },
            responsibilities: { type: 'array', items: { type: 'string' } },
            technologies: { type: 'array', items: { type: 'string' } },
            achievements: { type: 'array', items: { type: 'string' } },
          },
        },
        Education: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            degree: { type: 'string' },
            institution: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            result: { type: 'string' },
          },
        },
        Skill: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            category: { type: 'string', enum: ['Frontend', 'Backend', 'Database', 'Cloud', 'Testing', 'DevOps', 'Languages', 'Soft Skills'] },
            level: { type: 'string', enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'] },
          },
        },
        Project: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            technologies: { type: 'array', items: { type: 'string' } },
            github: { type: 'string' },
            demo: { type: 'string' },
          },
        },
        Certificate: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            issuer: { type: 'string' },
            date: { type: 'string' },
            url: { type: 'string' },
          },
        },
        Award: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            issuer: { type: 'string' },
            date: { type: 'string' },
            description: { type: 'string' },
          },
        },
        Publication: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            publisher: { type: 'string' },
            date: { type: 'string' },
            url: { type: 'string' },
          },
        },
        Volunteering: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            organization: { type: 'string' },
            role: { type: 'string' },
            startDate: { type: 'string' },
            endDate: { type: 'string' },
            current: { type: 'boolean' },
            description: { type: 'string' },
          },
        },
        Language: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            proficiency: { type: 'string', enum: ['Native', 'Fluent', 'Advanced', 'Intermediate', 'Basic'] },
          },
        },
        Interest: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            category: { type: 'string' },
          },
        },

        // ── Applications ──────────────────────────────────────────────
        Application: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            company: { type: 'string' },
            role: { type: 'string' },
            jdText: { type: 'string' },
            status: {
              type: 'string',
              enum: ['draft', 'analyzing', 'planning', 'generating', 'reviewing', 'ready', 'exported', 'applied', 'interview', 'assessment', 'offer', 'rejected', 'ghosted'],
            },
            timeline: { type: 'array', items: { '$ref': '#/components/schemas/TimelineEvent' } },
            notes: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            scores: {
              type: 'object',
              properties: {
                ats: { type: 'number' },
                match: { type: 'number' },
                overall: { type: 'number' },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        TimelineEvent: {
          type: 'object',
          properties: {
            event: { type: 'string' },
            date: { type: 'string', format: 'date-time' },
            notes: { type: 'string' },
          },
        },
        JDAnalysis: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            company: { type: 'string' },
            role: { type: 'string' },
            requiredSkills: { type: 'array', items: { type: 'string' } },
            niceToHaveSkills: { type: 'array', items: { type: 'string' } },
            keywords: { type: 'array', items: { type: 'string' } },
            atsTerms: { type: 'array', items: { type: 'string' } },
            redFlags: { type: 'array', items: { type: 'string' } },
            matchScore: { type: 'number' },
            summary: { type: 'string' },
          },
        },

        // ── Resume ────────────────────────────────────────────────────
        ResumeVersion: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            applicationId: { type: 'string' },
            version: { type: 'integer' },
            template: { type: 'string', enum: ['minimal', 'modern', 'ats', 'academic', 'creative'] },
            scores: {
              type: 'object',
              properties: { ats: { type: 'number' }, overall: { type: 'number' } },
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ResumeStrategy: {
          type: 'object',
          properties: {
            selectedExperienceIds: { type: 'array', items: { type: 'string' } },
            selectedProjectIds: { type: 'array', items: { type: 'string' } },
            matchedSkills: { type: 'array', items: { type: 'string' } },
            reasoning: { type: 'object', additionalProperties: { type: 'string' } },
          },
        },

        // ── Validation & Export ───────────────────────────────────────
        ValidationReport: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            overallPassed: { type: 'boolean' },
            blocked: { type: 'boolean' },
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  score: { type: 'number' },
                  passed: { type: 'boolean' },
                  issues: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        severity: { type: 'string', enum: ['error', 'warning'] },
                        message: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ExportRecord: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            format: { type: 'string', enum: ['pdf', 'docx', 'md'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },

        // ── Interview ─────────────────────────────────────────────────
        InterviewPrep: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  type: { type: 'string' },
                  answer: { type: 'string' },
                },
              },
            },
            companyResearch: { type: 'string' },
            talkingPoints: { type: 'array', items: { type: 'string' } },
            weakAreas: { type: 'array', items: { type: 'string' } },
          },
        },

        // ── Notifications ─────────────────────────────────────────────
        Notification: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            type: { type: 'string', enum: ['application', 'interview', 'offer', 'feature', 'reminder', 'community'] },
            title: { type: 'string' },
            message: { type: 'string' },
            link: { type: 'string' },
            read: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },

        // ── Community ─────────────────────────────────────────────────
        Discussion: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            content: { type: 'string' },
            channel: { type: 'string' },
            author: { type: 'string' },
            replyCount: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Opportunity: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'string', enum: ['job', 'internship', 'referral', 'mentorship', 'collaboration'] },
            company: { type: 'string' },
            location: { type: 'string' },
            postedBy: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Referral: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            fromUserId: { type: 'string' },
            toUserId: { type: 'string' },
            opportunityId: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'accepted', 'declined'] },
            message: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        CommunityTemplate: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            type: { type: 'string', enum: ['discussion', 'opportunity', 'referral'] },
            content: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Workspace: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            memberCount: { type: 'integer' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Contribution: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            type: { type: 'string', enum: ['application', 'review', 'feedback', 'referral'] },
            content: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },

        // ── Analytics ─────────────────────────────────────────────────
        AnalyticsSummary: {
          type: 'object',
          properties: {
            totalApps: { type: 'integer' },
            byStatus: { type: 'object', additionalProperties: { type: 'integer' } },
            interviewRate: { type: 'number' },
            offerRate: { type: 'number' },
            avgMatchScore: { type: 'number', nullable: true },
          },
        },

        // ── Learning ──────────────────────────────────────────────────
        LearningData: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            title: { type: 'string' },
            type: { type: 'string' },
            content: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },

        // ── Uploaded Resume ──────────────────────────────────────────
        UploadedResume: {
          type: 'object',
          properties: {
            _id: { type: 'string' },
            fileName: { type: 'string' },
            fileType: { type: 'string', enum: ['docx', 'doc', 'pdf'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    paths: {
      // ═════════════════════════════════════════════════════════════════
      // HEALTH
      // ═════════════════════════════════════════════════════════════════
      '/api/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          description: 'Returns server status and current timestamp.',
          responses: {
            '200': {
              description: 'Server is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },

      // ═════════════════════════════════════════════════════════════════
      // AUTH
      // ═════════════════════════════════════════════════════════════════
      '/api/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new account',
          description: 'Creates a new user account with email/password. Sets session cookie and sends verification email.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { '$ref': '#/components/schemas/RegisterRequest' } } },
          },
          responses: {
            '201': { description: 'Account created. Session cookie set.', content: { 'application/json': { schema: { type: 'object', properties: { user: { '$ref': '#/components/schemas/User' } } } } } },
            '409': { description: 'Email already registered', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login with email and password',
          description: 'Authenticates the user and sets an httpOnly JWT session cookie.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { '$ref': '#/components/schemas/LoginRequest' } } },
          },
          responses: {
            '200': { description: 'Login successful. Session cookie set.', content: { 'application/json': { schema: { type: 'object', properties: { user: { '$ref': '#/components/schemas/User' } } } } } },
            '401': { description: 'Invalid email or password', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          },
        },
      },
      '/api/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Logout',
          description: 'Clears the session cookie.',
          responses: {
            '200': { description: 'Logged out successfully' },
          },
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current user',
          description: 'Returns the authenticated user profile.',
          security: [{ SessionCookie: [] }],
          responses: {
            '200': { description: 'User profile', content: { 'application/json': { schema: { '$ref': '#/components/schemas/User' } } } },
            '401': { description: 'Not authenticated', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Error' } } } },
          },
        },
      },
      '/api/auth/google': {
        post: {
          tags: ['Auth'],
          summary: 'Authenticate with Google',
          description: 'Sign in or register using a Google OAuth access token.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { '$ref': '#/components/schemas/GoogleAuthRequest' } } },
          },
          responses: {
            '200': { description: 'Authenticated. Session cookie set.' },
            '401': { description: 'Google authentication failed' },
          },
        },
      },
      '/api/auth/github': {
        post: {
          tags: ['Auth'],
          summary: 'Authenticate with GitHub',
          description: 'Sign in or register using a GitHub OAuth authorization code.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { '$ref': '#/components/schemas/GithubAuthRequest' } } },
          },
          responses: {
            '200': { description: 'Authenticated. Session cookie set.' },
            '401': { description: 'GitHub authentication failed' },
          },
        },
      },
      '/api/auth/preferences': {
        get: {
          tags: ['Auth'],
          summary: 'Get user preferences',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'User preferences', content: { 'application/json': { schema: { '$ref': '#/components/schemas/UserPreferences' } } } } },
        },
        put: {
          tags: ['Auth'],
          summary: 'Update user preferences',
          security: [{ SessionCookie: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/UserPreferences' } } } },
          responses: { '200': { description: 'Preferences updated' } },
        },
      },
      '/api/auth/password': {
        put: {
          tags: ['Auth'],
          summary: 'Change password',
          security: [{ SessionCookie: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/ChangePasswordRequest' } } } },
          responses: { '200': { description: 'Password changed' }, '401': { description: 'Current password incorrect' } },
        },
      },
      '/api/auth/forgot-password': {
        post: {
          tags: ['Auth'],
          summary: 'Request password reset',
          description: 'Sends a password reset email if the email exists. Always returns success to prevent email enumeration.',
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/ForgotPasswordRequest' } } } },
          responses: { '200': { description: 'Reset email sent if account exists' } },
        },
      },
      '/api/auth/reset-password': {
        post: {
          tags: ['Auth'],
          summary: 'Reset password with token',
          description: 'Resets the password using a token received via email. Creates a new session on success.',
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/ResetPasswordRequest' } } } },
          responses: { '200': { description: 'Password reset. New session cookie set.' }, '400': { description: 'Invalid or expired token' } },
        },
      },
      '/api/auth/verify-email': {
        post: {
          tags: ['Auth'],
          summary: 'Verify email address',
          description: 'Verifies a user email using the token sent after registration.',
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/VerifyEmailRequest' } } } },
          responses: { '200': { description: 'Email verified successfully' }, '400': { description: 'Invalid or expired token' } },
        },
      },
      '/api/auth/resend-verification': {
        post: {
          tags: ['Auth'],
          summary: 'Resend verification email',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'Verification email sent' }, '400': { description: 'Email already verified' } },
        },
      },
      '/api/auth/api-key': {
        post: {
          tags: ['Auth'],
          summary: 'Save an API key for an AI provider',
          security: [{ SessionCookie: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/SaveApiKeyRequest' } } } },
          responses: { '200': { description: 'API key saved' } },
        },
      },
      '/api/auth/account': {
        delete: {
          tags: ['Auth'],
          summary: 'Delete account',
          description: 'Permanently deletes the user account and all associated data.',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'Account deleted' } },
        },
      },

      // ═════════════════════════════════════════════════════════════════
      // PROFILE
      // ═════════════════════════════════════════════════════════════════
      '/api/profile/personal': {
        get: {
          tags: ['Profile'],
          summary: 'Get personal profile info',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'Personal profile data' } },
        },
        put: {
          tags: ['Profile'],
          summary: 'Update personal profile',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'Profile updated' } },
        },
      },
      '/api/profile/experiences': {
        get: {
          tags: ['Profile'],
          summary: 'List experiences',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'List of work experiences', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Experience' } } } } } },
        },
        post: {
          tags: ['Profile'],
          summary: 'Create experience entry',
          security: [{ SessionCookie: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { '$ref': '#/components/schemas/Experience' } } } },
          responses: { '201': { description: 'Experience created' } },
        },
      },
      '/api/profile/experiences/{id}': {
        get: { tags: ['Profile'], summary: 'Get experience by ID', security: [{ SessionCookie: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Experience details' } } },
        put: { tags: ['Profile'], summary: 'Update experience', security: [{ SessionCookie: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Experience updated' } } },
        delete: { tags: ['Profile'], summary: 'Delete experience', security: [{ SessionCookie: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Experience deleted' } } },
      },
      '/api/profile/education': {
        get: { tags: ['Profile'], summary: 'List education entries', security: [{ SessionCookie: [] }], responses: { '200': { description: 'List of education', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Education' } } } } } } },
        post: { tags: ['Profile'], summary: 'Create education entry', security: [{ SessionCookie: [] }], responses: { '201': { description: 'Education created' } } },
      },
      '/api/profile/education/{id}': {
        get: { tags: ['Profile'], summary: 'Get education by ID', security: [{ SessionCookie: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Education details' } } },
        put: { tags: ['Profile'], summary: 'Update education', security: [{ SessionCookie: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Education updated' } } },
        delete: { tags: ['Profile'], summary: 'Delete education', security: [{ SessionCookie: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Education deleted' } } },
      },
      '/api/profile/skills': {
        get: { tags: ['Profile'], summary: 'List skills', security: [{ SessionCookie: [] }], responses: { '200': { description: 'List of skills', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Skill' } } } } } } },
        post: { tags: ['Profile'], summary: 'Create skill', security: [{ SessionCookie: [] }], responses: { '201': { description: 'Skill created' } } },
      },
      '/api/profile/projects': {
        get: { tags: ['Profile'], summary: 'List projects', security: [{ SessionCookie: [] }], responses: { '200': { description: 'List of projects', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Project' } } } } } } },
        post: { tags: ['Profile'], summary: 'Create project', security: [{ SessionCookie: [] }], responses: { '201': { description: 'Project created' } } },
      },
      '/api/profile/certificates': {
        get: { tags: ['Profile'], summary: 'List certificates', security: [{ SessionCookie: [] }], responses: { '200': { description: 'List of certificates', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Certificate' } } } } } } },
        post: { tags: ['Profile'], summary: 'Create certificate', security: [{ SessionCookie: [] }], responses: { '201': { description: 'Certificate created' } } },
      },
      '/api/profile/awards': {
        get: { tags: ['Profile'], summary: 'List awards', security: [{ SessionCookie: [] }], responses: { '200': { description: 'List of awards', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Award' } } } } } } },
        post: { tags: ['Profile'], summary: 'Create award', security: [{ SessionCookie: [] }], responses: { '201': { description: 'Award created' } } },
      },
      '/api/profile/publications': {
        get: { tags: ['Profile'], summary: 'List publications', security: [{ SessionCookie: [] }], responses: { '200': { description: 'List of publications', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Publication' } } } } } } },
        post: { tags: ['Profile'], summary: 'Create publication', security: [{ SessionCookie: [] }], responses: { '201': { description: 'Publication created' } } },
      },
      '/api/profile/volunteering': {
        get: { tags: ['Profile'], summary: 'List volunteering entries', security: [{ SessionCookie: [] }], responses: { '200': { description: 'List of volunteering', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Volunteering' } } } } } } },
        post: { tags: ['Profile'], summary: 'Create volunteering entry', security: [{ SessionCookie: [] }], responses: { '201': { description: 'Volunteering created' } } },
      },
      '/api/profile/languages': {
        get: { tags: ['Profile'], summary: 'List languages', security: [{ SessionCookie: [] }], responses: { '200': { description: 'List of languages', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Language' } } } } } } },
        post: { tags: ['Profile'], summary: 'Create language entry', security: [{ SessionCookie: [] }], responses: { '201': { description: 'Language created' } } },
      },
      '/api/profile/interests': {
        get: { tags: ['Profile'], summary: 'List interests', security: [{ SessionCookie: [] }], responses: { '200': { description: 'List of interests', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Interest' } } } } } } },
        post: { tags: ['Profile'], summary: 'Create interest', security: [{ SessionCookie: [] }], responses: { '201': { description: 'Interest created' } } },
      },

      // ═════════════════════════════════════════════════════════════════
      // APPLICATIONS
      // ═════════════════════════════════════════════════════════════════
      '/api/applications': {
        get: {
          tags: ['Applications'],
          summary: 'List all job applications',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'List of applications', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Application' } } } } } },
        },
        post: {
          tags: ['Applications'],
          summary: 'Create a new application',
          security: [{ SessionCookie: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { company: { type: 'string' }, role: { type: 'string' }, jdText: { type: 'string' } } } } } },
          responses: { '201': { description: 'Application created', content: { 'application/json': { schema: { '$ref': '#/components/schemas/Application' } } } } },
        },
      },
      '/api/applications/{id}': {
        get: { tags: ['Applications'], summary: 'Get application details', security: [{ SessionCookie: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Application details' } } },
        put: { tags: ['Applications'], summary: 'Update application', security: [{ SessionCookie: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Application updated' } } },
        delete: { tags: ['Applications'], summary: 'Delete application', security: [{ SessionCookie: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Application deleted' } } },
      },

      // ═════════════════════════════════════════════════════════════════
      // JOB ANALYSIS
      // ═════════════════════════════════════════════════════════════════
      '/api/jd/analyze': {
        post: {
          tags: ['Job Analysis'],
          summary: 'Analyze a job description',
          security: [{ SessionCookie: [] }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { jdText: { type: 'string' }, company: { type: 'string' }, role: { type: 'string' } } } } } },
          responses: { '200': { description: 'JD analysis result', content: { 'application/json': { schema: { '$ref': '#/components/schemas/JDAnalysis' } } } } },
        },
      },
      '/api/jd/compare': {
        post: {
          tags: ['Job Analysis'],
          summary: 'Compare job descriptions',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'Comparison result' } },
        },
      },

      // ═════════════════════════════════════════════════════════════════
      // RESUME
      // ═════════════════════════════════════════════════════════════════
      '/api/resume/analyze': {
        post: {
          tags: ['Resume'],
          summary: 'Analyze uploaded resume',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'Resume analysis result' } },
        },
      },
      '/api/resume/generate': {
        post: {
          tags: ['Resume'],
          summary: 'Generate a tailored resume',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'Generated resume content' } },
        },
      },
      '/api/resume/versions': {
        get: {
          tags: ['Resume'],
          summary: 'List resume versions',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'List of resume versions', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/ResumeVersion' } } } } } },
        },
      },
      '/api/strategy/generate': {
        post: {
          tags: ['Resume'],
          summary: 'Generate resume strategy',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'Resume strategy', content: { 'application/json': { schema: { '$ref': '#/components/schemas/ResumeStrategy' } } } } },
        },
      },

      // ═════════════════════════════════════════════════════════════════
      // CONTENT
      // ═════════════════════════════════════════════════════════════════
      '/api/content/generate': {
        post: {
          tags: ['Content'],
          summary: 'Generate AI content (cover letter, summary, etc.)',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'Generated content' } },
        },
      },

      // ═════════════════════════════════════════════════════════════════
      // SMART APPLICATION
      // ═════════════════════════════════════════════════════════════════
      '/api/v1/applications': {
        post: {
          tags: ['Smart Application'],
          summary: 'Create a smart application with AI assistance',
          security: [{ SessionCookie: [] }],
          responses: { '201': { description: 'Smart application created' } },
        },
      },
      '/api/v1/applications/{id}/analyze': {
        post: {
          tags: ['Smart Application'],
          summary: 'Analyze an application',
          security: [{ SessionCookie: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { '200': { description: 'Analysis result' } },
        },
      },

      // ═════════════════════════════════════════════════════════════════
      // VALIDATION
      // ═════════════════════════════════════════════════════════════════
      '/api/validate': {
        post: {
          tags: ['Validation'],
          summary: 'Validate a resume or document',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'Validation report', content: { 'application/json': { schema: { '$ref': '#/components/schemas/ValidationReport' } } } } },
        },
      },

      // ═════════════════════════════════════════════════════════════════
      // EXPORT
      // ═════════════════════════════════════════════════════════════════
      '/api/export/resume': {
        post: {
          tags: ['Export'],
          summary: 'Export resume as PDF/DOCX',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'Exported file' } },
        },
      },
      '/api/exports': {
        get: {
          tags: ['Export'],
          summary: 'List export history',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'List of export records', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/ExportRecord' } } } } } },
        },
      },

      // ═════════════════════════════════════════════════════════════════
      // INTERVIEW PREP
      // ═════════════════════════════════════════════════════════════════
      '/api/interview/prepare': {
        post: {
          tags: ['Interview'],
          summary: 'Generate interview preparation questions',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'Interview prep content', content: { 'application/json': { schema: { '$ref': '#/components/schemas/InterviewPrep' } } } } },
        },
      },
      '/api/interview/practice': {
        post: {
          tags: ['Interview'],
          summary: 'Save interview practice answers',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'Practice saved' } },
        },
      },

      // ═════════════════════════════════════════════════════════════════
      // ANALYTICS
      // ═════════════════════════════════════════════════════════════════
      '/api/analytics/summary': {
        get: {
          tags: ['Analytics'],
          summary: 'Get analytics summary',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'Analytics summary', content: { 'application/json': { schema: { '$ref': '#/components/schemas/AnalyticsSummary' } } } } },
        },
      },
      '/api/analytics/community': {
        get: {
          tags: ['Analytics'],
          summary: 'Get community analytics',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'Community analytics' } },
        },
      },

      // ═════════════════════════════════════════════════════════════════
      // NOTIFICATIONS
      // ═════════════════════════════════════════════════════════════════
      '/api/notifications': {
        get: {
          tags: ['Notifications'],
          summary: 'List user notifications',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'List of notifications', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Notification' } } } } } },
        },
      },
      '/api/notifications/read-all': {
        post: {
          tags: ['Notifications'],
          summary: 'Mark all notifications as read',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'All marked as read' } },
        },
      },

      // ═════════════════════════════════════════════════════════════════
      // LEARNING
      // ═════════════════════════════════════════════════════════════════
      '/api/learning': {
        get: {
          tags: ['Learning'],
          summary: 'List learning content',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'List of learning items', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/LearningData' } } } } } },
        },
        post: {
          tags: ['Learning'],
          summary: 'Create learning content',
          security: [{ SessionCookie: [] }],
          responses: { '201': { description: 'Learning content created' } },
        },
      },

      // ═════════════════════════════════════════════════════════════════
      // COMMUNITY
      // ═════════════════════════════════════════════════════════════════
      '/api/v1/community/feed': {
        get: {
          tags: ['Community'],
          summary: 'Get community feed',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'Community feed' } },
        },
      },
      '/api/discussions': {
        get: {
          tags: ['Community'],
          summary: 'List discussions',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'List of discussions', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Discussion' } } } } } },
        },
        post: {
          tags: ['Community'],
          summary: 'Create a discussion',
          security: [{ SessionCookie: [] }],
          responses: { '201': { description: 'Discussion created' } },
        },
      },
      '/api/discussions/{id}': {
        get: { tags: ['Community'], summary: 'Get discussion details', security: [{ SessionCookie: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Discussion details' } } },
      },
      '/api/opportunities': {
        get: {
          tags: ['Community'],
          summary: 'List opportunities',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'List of opportunities', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Opportunity' } } } } } },
        },
        post: {
          tags: ['Community'],
          summary: 'Create an opportunity',
          security: [{ SessionCookie: [] }],
          responses: { '201': { description: 'Opportunity created' } },
        },
      },
      '/api/opportunities/{opportunityId}/contributions': {
        get: { tags: ['Community'], summary: 'List contributions to an opportunity', security: [{ SessionCookie: [] }], parameters: [{ name: 'opportunityId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'List of contributions' } } },
        post: { tags: ['Community'], summary: 'Create a contribution', security: [{ SessionCookie: [] }], responses: { '201': { description: 'Contribution created' } } },
      },
      '/api/workspaces': {
        get: { tags: ['Workspace'], summary: 'List workspaces', security: [{ SessionCookie: [] }], responses: { '200': { description: 'List of workspaces', content: { 'application/json': { schema: { type: 'array', items: { '$ref': '#/components/schemas/Workspace' } } } } } } },
        post: { tags: ['Workspace'], summary: 'Create a workspace', security: [{ SessionCookie: [] }], responses: { '201': { description: 'Workspace created' } } },
      },
      '/api/workspaces/{id}': {
        get: { tags: ['Workspace'], summary: 'Get workspace details', security: [{ SessionCookie: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Workspace details' } } },
        put: { tags: ['Workspace'], summary: 'Update workspace', security: [{ SessionCookie: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Workspace updated' } } },
        delete: { tags: ['Workspace'], summary: 'Delete workspace', security: [{ SessionCookie: [] }], parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Workspace deleted' } } },
      },

      // ═════════════════════════════════════════════════════════════════
      // ENGINE / OBSERVABILITY
      // ═════════════════════════════════════════════════════════════════
      '/api/v1/engine/health': {
        get: {
          tags: ['Observability'],
          summary: 'Engine health check',
          responses: { '200': { description: 'Engine status' } },
        },
      },
      '/api/v1/engine/learning': {
        post: {
          tags: ['Observability'],
          summary: 'Submit learning feedback',
          security: [{ SessionCookie: [] }],
          responses: { '200': { description: 'Feedback recorded' } },
        },
      },
    },
}

// Create a router to serve Swagger UI
const router = Router()

// Raw OpenAPI spec as JSON
router.get('/api-docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(swaggerSpec)
})

// Swagger UI at /api-docs
router.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'ApplyFlow AI API Docs',
    customCss: '.swagger-ui .topbar { display: none } .swagger-ui { max-width: 1400px; margin: 0 auto; }',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
    },
  }),
)

// Redirect from /docs to /api-docs
router.get('/docs', (_req, res) => {
  res.redirect('/api-docs')
})

export default router
export { swaggerSpec }
