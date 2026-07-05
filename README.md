# ApplyFlow AI - Backend Service

ApplyFlow AI Backend is a modular Node.js Express service built with TypeScript. It orchestrates resume parsing, document intelligence, JD (Job Description) analysis, and automated tailoring workflows using local and cloud AI providers.

---

## 🛠️ Tech Stack & Key Dependencies

- **Runtime & Compilation:** Node.js, TypeScript, `tsx` (for hot reloading in development)
- **Web Framework:** Express (with system-level modular routing)
- **Database:** MongoDB via Mongoose
- **Document Extractors:**
  - `pdfjs-dist/legacy/build/pdf` - Custom link-aware PDF text and annotation extractor.
  - `mammoth` - HTML/text extraction from `.docx` files.
- **AI Infrastructure:**
  - Local Ollama connection (`qwen2.5:3b` default optimized configuration).
  - Configurable providers for OpenAI and other models.
- **Validation & Parsing:** `zod` schema verification.

---

## 📂 Subsystem Directory Structure

All business logic is isolated within the `src/systems/` directory. Each subsystem contains its own routing, controller logic, and helpers:

```
src/
├── config/                  # Server configuration and environment mapping
├── middleware/              # Authentication & schema validation gates
├── models/                  # Shared Mongoose schemas (User, Experience, Project, etc.)
├── systems/                 # Modular service engines
│   ├── ai/                  # Multi-provider AI Gateway (Ollama, OpenAI, Mock)
│   ├── analytics/           # Candidate application and profile metrics APIs
│   ├── application-mgnt/    # Job application status pipelines
│   ├── career-data/         # Resume parsers (PDF, DOCX) and profile databases
│   ├── content-generation/  # Cover letter & tailored bullet generation
│   ├── document-validation/ # ATS alignment and honesty checker
│   ├── export/              # Generators for PDF, DOCX, and Markdown formats
│   ├── identity/            # JWT authentication, user registration, and OAuth
│   ├── interview-intel/     # AI mock interviews & question generators
│   ├── job-intelligence/    # JD parser and profile overlap scorer
│   ├── learning/            # User edits feedback loops for local model fine-tuning
│   ├── notifications/       # User alert and dispatch router
│   ├── resume-planning/     # Skill GAP analyzers
│   ├── resume-writing/      # Dynamic tailoring modules
│   └── smart-application/   # Multi-step automated package generation
└── utils/                   # Standard cryptographic and response formatting modules
```

---

## 🔬 Core Service Features

### 📄 Link-Aware PDF Parsing (`src/systems/career-data/pdfParser.ts`)
Instead of plain-text parsing that discards underlying URLs behind text, this system uses `pdfjs-dist` to retrieve annotations. It reads both plain text content and `Link`-type objects, appending explicit URLs directly into the raw text block, allowing downstream AI models to extract hyperlinked portfolio sites and project repos.

### 🧠 Prompt Compiler & Ollama Adaptability (`src/systems/career-data/pdfExtractor.ts`)
Designed specifically to work with smaller parameter models (like `qwen2.5:3b` on Ollama). The prompt uses a simplified schema and explicit formatting limits to ensure the AI parses documents cleanly into JSON arrays rather than overloading and grouping contents into single long-form summaries.

### 💼 CRUD Router Factory (`src/systems/career-data/crudFactory.ts`)
Implements a reusable factory design pattern for generating complete RESTful endpoints for career records (Skills, Experiences, Projects, etc.), dramatically reducing duplicate routing logic.

---

## 🚀 Getting Started

### 📋 Prerequisites
- Node.js (v18+)
- MongoDB running locally or a MongoDB Atlas URI
- Ollama running locally (for parsing without cloud costs)
  - Ensure the model is downloaded: `ollama run qwen2.5:3b`

### 🔧 Configuration (`.env`)
Create a `.env` file in the backend root directory matching `.env.example`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/applyflow
JWT_SECRET=your_jwt_signing_key_here
AI_PROVIDER=ollama
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_HOST=http://127.0.0.1:11434
```

### 💻 Installation & Commands
1. Install development dependencies:
   ```bash
   npm install
   ```
2. Start the development server (runs hot-reloaded watch loop using `tsx`):
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```
4. Run database seeds:
   ```bash
   npm run seed:dev      # Seeds dummy applications and status logs
   npm run seed:profile  # Seeds a demo career profile
   ```
