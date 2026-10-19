# DocChat

**Ask questions about your own documents and get answers with the page they came from.**

DocChat is a full-stack Retrieval-Augmented Generation (RAG) application. Upload a PDF, Word file, PowerPoint, Excel sheet or text file; DocChat splits it into passages, turns each passage into an embedding stored in PostgreSQL (pgvector), and answers your questions using only the passages that match, citing the page each answer came from. On top of that it generates summaries, multiple-choice quizzes, viva (oral exam) questions and a concept map for each document, and can answer questions across several documents at once.

<!-- Add your live link here after deploying -->
**Live demo:** https://rag-doc-chat-alpha.vercel.app

![Asking a question about a PDF](docs/screenshots/chat.png)

---

## Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Database](#database)
- [API](#api)
- [Project structure](#project-structure)
- [Running it locally](#running-it-locally)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Design decisions](#design-decisions)
- [Limitations and next steps](#limitations-and-next-steps)

---

## Features

| Feature | What it does |
|---|---|
| **Document Q&A** | Ask a question in plain language. The answer is written only from the matching passages of your document and lists the pages it used. Answers stream in word by word. |
| **Multi-format upload** | PDF, DOCX, PPTX, XLSX/XLS and TXT, up to 20 MB. Text is extracted page by page (slide by slide, sheet by sheet) so citations point to the right place. |
| **Workspaces** | Group several documents and ask one question across all of them. The answer says which file each fact came from and points out where the files disagree. |
| **Compare two documents** | Differences, common ground, or a side-by-side comparison table. |
| **Summaries** | An overview, key takeaways by topic, a glossary, reading time and difficulty. Long documents are summarised section by section in parallel, then combined (map-reduce). |
| **Quiz and viva practice** | Multiple-choice quizzes (easy / medium / hard, scored) and viva questions with model answers and key points to mention. |
| **Concept map** | Extracts the main concepts and how they relate, drawn as an interactive graph (network or radial view), exportable as SVG/PNG. |
| **Voice** | Speak your question (speech-to-text) and have answers read aloud (text-to-speech) using the browser's Web Speech API. |
| **Export** | Chat history to PDF or Markdown; a study guide PDF combining summary, glossary and quiz. |
| **Usage page** | Questions asked, documents and pages indexed, quiz scores, daily activity, average model latency and storage used. |
| **Accounts** | Email + password sign-up (bcrypt-hashed), optional Google sign-in (verified ID tokens), JWT sessions. Every query is scoped to the signed-in user. |
| **Light and dark themes** | Follows the system setting or can be set manually. |

---

## Screenshots

> These screenshots were taken with sample biology notes. Replace them with your own (same file names in `docs/screenshots/`) after you run the app with your Gemini key.

| | |
|---|---|
| **Sign in** — shows a worked example of what the app does<br>![Login](docs/screenshots/login.png) | **Your documents** — upload, status, and per-document tools<br>![Dashboard](docs/screenshots/dashboard.png) |
| **Summary** — overview, key takeaways and glossary<br>![Summary](docs/screenshots/summary.png) | **Quiz** — generated MCQs with difficulty and scoring<br>![Quiz](docs/screenshots/quiz.png) |
| **Workspace** — one question answered across two files<br>![Workspace](docs/screenshots/workspace.png) | **Concept map** — concepts and relationships from the document<br>![Concept map](docs/screenshots/concept-map.png) |
| **Usage** — activity, storage and latency<br>![Analytics](docs/screenshots/analytics.png) | **Dark theme**<br>![Dark theme](docs/screenshots/chat-dark.png) |

---

## How it works

### Architecture

```mermaid
flowchart LR
    UI["React app<br/>(Vite, Tailwind)"]

    subgraph API["Node.js / Express API"]
        direction TB
        AUTH["Auth<br/>JWT · bcrypt · Google"]
        ING["Ingestion<br/>extract → chunk → embed"]
        RAG["Q&A<br/>embed question → search → answer"]
        GEN["Summaries · quizzes · concept maps"]
    end

    DB[("PostgreSQL + pgvector<br/>users, documents, chunks + embeddings,<br/>chats, quizzes, summaries")]
    GEMINI["Google Gemini API<br/>embeddings + text generation"]
    DISK[("uploads/<br/>original files")]

    UI -- "REST / JSON<br/>SSE for streamed answers" --> API
    API -- "SQL" --> DB
    API -- "HTTPS" --> GEMINI
    ING -.-> DISK
```

### 1. Uploading a document (ingestion)

```mermaid
sequenceDiagram
    actor U as User
    participant FE as React
    participant API as Express
    participant DB as PostgreSQL
    participant G as Gemini

    U->>FE: choose file
    FE->>API: POST /documents/upload (multipart)
    API->>API: check extension and size (multer)
    API->>DB: INSERT documents (status = processing)
    API-->>FE: 202 Accepted {id}
    Note over API: continues in the background
    API->>API: extract text per page / slide / sheet
    API->>API: split into ~2,000-character chunks with 200-character overlap
    API->>G: embed chunks (batches of 25)
    G-->>API: one 3,072-number vector per chunk
    API->>DB: INSERT chunks (text, page, embedding) in one transaction
    API->>DB: UPDATE documents SET status = ready
    FE->>API: GET /documents (polls while processing)
    API-->>FE: status = ready
```

### 2. Asking a question (retrieval + generation)

```mermaid
sequenceDiagram
    actor U as User
    participant FE as React
    participant API as Express
    participant DB as PostgreSQL + pgvector
    participant G as Gemini

    U->>FE: "Where does the Calvin cycle happen?"
    FE->>API: POST /chats/:documentId/message/stream
    API->>DB: check the document belongs to this user and is ready
    API->>G: embed the question
    G-->>API: question vector
    API->>DB: top 4 chunks by cosine distance (embedding <=> question)
    DB-->>API: passages + page numbers + similarity
    API-->>FE: event: sources
    API->>G: prompt = instructions + 4 passages + question (streamed)
    loop as the answer is generated
        G-->>API: next piece of text
        API-->>FE: event: delta
    end
    API->>DB: save question and answer (with sources) to chat history
    API-->>FE: event: done
```

The prompt tells the model to use **only** the supplied passages and to say *"I don't have enough information in this document"* when the answer isn't there. That instruction, plus showing the source passages, is what keeps answers grounded.

### 3. Summaries, quizzes and concept maps

These don't need a search: they read the document's chunks directly.

- **Summary.** Up to 15 chunks are summarised in one call. Longer documents use **map-reduce**: groups of 8 chunks are summarised in parallel (4 at a time), then one final call combines the section summaries into the overview, takeaways and glossary.
- **Quiz / viva.** Up to 15 chunks, sampled evenly from start to end so questions cover the whole document, are sent with a request for JSON. The response is validated (4 options, a valid correct-answer index) before it is saved.
- **Concept map.** Up to 16 evenly sampled chunks; the model returns nodes and edges as JSON; edges pointing at concepts that don't exist are dropped. The browser lays the graph out with a small force simulation on a `<canvas>`.

### Reliability

- **Model fallback.** Gemini calls try a list of models in order (`GEMINI_MODELS`). If one is overloaded (503) or rate-limited (429) it is retried once, then the next model is used. Models that don't exist (404) are skipped for the rest of the session.
- **Low "thinking" for speed.** Gemini 3 models reason before answering by default. For grounded Q&A that only adds waiting time, so the app sets the lowest thinking level each model allows.
- **Streaming** answers over Server-Sent Events, so the first words appear as soon as they are generated.

---

## Tech stack

### Frontend

| Technology | Used for |
|---|---|
| **React 19** | UI components and state |
| **Vite 8** | Dev server and production build |
| **React Router 7** | Pages: login, dashboard, chat, quiz, concept map, workspaces, usage |
| **Tailwind CSS 4** | Styling. The colour palette and fonts are defined once in `src/index.css` |
| **Axios** | REST calls, with an interceptor that adds the JWT and logs out on 401 |
| **Fetch + ReadableStream** | Reading streamed answers (Server-Sent Events over POST) |
| **Lucide React** | Icons |
| **jsPDF + jspdf-autotable** | Exporting chats, summaries and study guides as PDF |
| **Web Speech API** | Voice input (`SpeechRecognition`) and read-aloud (`speechSynthesis`) |
| **Canvas 2D** | Concept-map drawing with a hand-written force-directed layout |
| **Public Sans + Literata** (self-hosted via Fontsource) | Interface text and reading text |

### Backend

| Technology | Used for |
|---|---|
| **Node.js + Express 5** | REST API, routing, error handling |
| **PostgreSQL** | All application data |
| **pgvector** | Storing embeddings in a `vector(3072)` column and ranking by cosine distance (`<=>`) |
| **node-postgres (`pg`)** | Database driver and connection pool |
| **@google/genai** | Gemini embeddings (`gemini-embedding-001`) and text generation (Gemini Flash models) |
| **Multer** | Multipart file uploads with type and size checks |
| **pdf-parse** | Text from PDFs, page by page |
| **mammoth** | Text from Word (.docx) |
| **xlsx (SheetJS)** | Text from Excel sheets |
| **JSZip** | Reading PowerPoint (.pptx) slide XML |
| **bcryptjs** | Password hashing |
| **jsonwebtoken** | Session tokens (7-day expiry) |
| **google-auth-library** | Verifying Google sign-in ID tokens |
| **CORS, dotenv** | Allowed origins; configuration from `.env` |

### AI models

| Model | Purpose |
|---|---|
| `gemini-embedding-001` | Turns each passage and each question into a 3,072-dimensional vector |
| Gemini Flash family (`gemini-3.6-flash` first, with fallbacks) | Answers, summaries, quizzes, viva questions, concept maps, comparisons |

---

## Database

### Entity-relationship diagram

```mermaid
erDiagram
    users ||--o{ documents : uploads
    users ||--o{ workspaces : owns
    documents ||--o{ chunks : "split into"
    documents ||--o{ chats : has
    chats ||--o{ messages : contains
    documents ||--o{ quizzes : has
    documents ||--o{ document_summaries : has
    documents ||--o{ document_knowledge_graphs : has
    workspaces ||--o{ workspace_documents : includes
    documents ||--o{ workspace_documents : "belongs to"
    workspaces ||--o{ workspace_chats : has
    workspace_chats ||--o{ workspace_messages : contains

    users {
        uuid id PK
        text first_name
        text last_name
        text email UK
        text password_hash "null for Google-only accounts"
        text auth_provider "local or google"
        text google_id
        text avatar_url
        timestamp created_at
    }
    documents {
        uuid id PK
        uuid user_id FK
        text filename
        text file_path
        text status "processing, ready, failed"
        int page_count
        int chunk_count
        text error_message
        timestamp created_at
    }
    chunks {
        uuid id PK
        uuid document_id FK
        int chunk_index
        int page_number
        text chunk_text
        vector embedding "vector(3072), pgvector"
    }
    chats {
        uuid id PK
        uuid user_id FK
        uuid document_id FK
        timestamp created_at
    }
    messages {
        uuid id PK
        uuid chat_id FK
        text role "user or assistant"
        text content
        text sources "JSON: page, snippet, score"
        timestamp created_at
    }
    quizzes {
        uuid id PK
        uuid document_id FK
        uuid user_id FK
        text quiz_type "mcq or viva"
        text title
        text difficulty
        jsonb questions
        jsonb user_answers
        int score
        int total_questions
        bool completed
        timestamp created_at
    }
    document_summaries {
        uuid id PK
        uuid document_id FK
        uuid user_id FK
        text executive_summary
        jsonb key_takeaways
        jsonb glossary
        int reading_time
        text difficulty
        timestamp created_at
    }
    document_knowledge_graphs {
        uuid id PK
        uuid document_id FK
        uuid user_id FK
        text central_topic
        text summary
        jsonb nodes
        jsonb edges
        timestamp created_at
    }
    workspaces {
        uuid id PK
        uuid user_id FK
        text name
        text description
        timestamp created_at
    }
    workspace_documents {
        uuid workspace_id PK, FK
        uuid document_id PK, FK
        timestamp added_at
    }
    workspace_chats {
        uuid id PK
        uuid workspace_id FK
        uuid user_id FK
        text title
        timestamp created_at
    }
    workspace_messages {
        uuid id PK
        uuid chat_id FK
        text role
        text content
        text sources
        timestamp created_at
    }
```

All foreign keys use `ON DELETE CASCADE`: deleting a document removes its chunks, embeddings, chats, quizzes, summaries and concept map in one statement.

### The vector search query

```sql
WITH candidates AS MATERIALIZED (
  SELECT id, document_id, page_number, chunk_text, embedding
  FROM chunks
  WHERE document_id = ANY($2::uuid[]) AND embedding IS NOT NULL
)
SELECT id, document_id, page_number, chunk_text,
       1 - (embedding <=> $1::vector) AS score      -- cosine similarity
FROM candidates
ORDER BY embedding <=> $1::vector                    -- cosine distance
LIMIT $3;
```

It first narrows down to the chunks of the document(s) being asked about (using the `document_id` index), then ranks just those by exact cosine distance. See [Design decisions](#design-decisions) for why this is exact rather than an approximate index.

### Indexes

| Index | Why |
|---|---|
| `chunks(document_id, chunk_index)` | Fast filtering for search, and reading a document's text in order |
| `documents(user_id, created_at DESC)` | The dashboard list |
| `quizzes(document_id, user_id)`, `document_summaries(document_id, user_id)`, `document_knowledge_graphs(document_id, user_id)` | Loading cached results |
| `workspaces(user_id)`, `workspace_documents(workspace_id)`, `workspace_chats(workspace_id)`, `workspace_messages(chat_id)` | Workspace pages |

Tables and indexes are created automatically when the server starts (`backend/src/db/db.js`).

---

## API

All routes except sign-up, login and `/health` need `Authorization: Bearer <token>`. Every route checks that the document, quiz or workspace belongs to the signed-in user.

| Method | Route | Description |
|---|---|---|
| POST | `/auth/signup` | Create an account |
| POST | `/auth/login` | Log in, returns a JWT |
| POST | `/auth/google` | Log in with a verified Google ID token |
| POST | `/documents/upload` | Upload a file (processed in the background) |
| GET | `/documents` | List your documents and their status |
| GET | `/documents/:id/content` | Extracted text, by page |
| POST | `/documents/:id/retry` | Re-process a failed document |
| DELETE | `/documents/:id` | Delete a document and everything derived from it |
| POST | `/chats/:documentId/message` | Ask a question (full answer as JSON) |
| POST | `/chats/:documentId/message/stream` | Ask a question (streamed with Server-Sent Events) |
| GET | `/chats/:documentId/history` | Chat history |
| GET / POST / DELETE | `/summaries/:documentId` | Read / generate (`{"force": true}` to regenerate) / clear the summary |
| POST | `/quiz/generate/:documentId` | Generate a quiz: `{"type": "mcq" or "viva", "count": 3-15, "difficulty": "easy"/"medium"/"hard"}` |
| GET | `/quiz/document/:documentId` | Quizzes for a document |
| GET | `/quiz/:quizId` | One quiz with questions |
| POST | `/quiz/:quizId/submit` | Submit answers, returns the score |
| DELETE | `/quiz/:quizId` | Delete a quiz |
| GET / DELETE | `/graphs/:documentId` | Read / clear the concept map |
| POST | `/graphs/:documentId/generate` | Generate the concept map |
| GET / POST | `/workspaces` | List / create workspaces |
| GET / PUT / DELETE | `/workspaces/:id` | Read / rename / delete a workspace |
| POST | `/workspaces/:id/documents` | Set which documents are in a workspace |
| POST | `/workspaces/:id/message` and `/message/stream` | Ask across the workspace's documents |
| GET | `/workspaces/:id/history` | Workspace chat history |
| POST | `/workspaces/:id/compare` | Compare two documents |
| GET | `/analytics/all?days=7` | Everything on the Usage page |
| GET | `/health` | Health check |

**Streaming format** (`/message/stream`): `text/event-stream` with events `sources` (citations), `delta` (`{"text": "..."}` pieces of the answer), `done` (`{"answer": "..."}`) and `error` (`{"error": "..."}`).

---

## Project structure

```
rag-doc-chat/
├── backend/
│   ├── server.js                 # Express app, error handler, startup
│   ├── scripts/reindex.js        # npm run reindex: re-create missing embeddings
│   └── src/
│       ├── db/db.js              # connection pool, schema, pgvector setup
│       ├── middleware/
│       │   ├── auth.js           # JWT check
│       │   └── validate.js       # UUID route-param validation
│       ├── routes/               # auth, documents, chat, quiz, summaries, graphs, workspaces, analytics
│       └── services/
│           ├── documentService.js   # text extraction: PDF, DOCX, XLSX, PPTX, TXT
│           ├── chunkService.js      # chunking with overlap
│           ├── embeddingService.js  # Gemini embeddings, batching, retry
│           ├── vectorStore.js       # pgvector insert + search
│           ├── geminiClient.js      # model fallback, thinking level, streaming
│           ├── llmService.js        # single-document Q&A prompt
│           ├── workspaceService.js  # multi-document Q&A, comparison
│           ├── summaryService.js    # summaries (map-reduce)
│           ├── quizService.js       # MCQ and viva generation
│           ├── graphService.js      # concept map extraction
│           ├── analyticsService.js  # usage numbers
│           ├── jsonUtils.js         # safe JSON parsing of model output
│           └── sse.js               # Server-Sent Events helper
├── frontend/
│   ├── index.html
│   ├── vercel.json               # SPA routing on Vercel
│   └── src/
│       ├── index.css             # theme: colours, fonts, Markdown styles
│       ├── api/client.js         # axios + auth
│       ├── api/stream.js         # reading streamed answers
│       ├── context/              # auth and theme state
│       ├── hooks/useVoiceAssistant.js
│       ├── components/           # Markdown renderer, summary modal, voice, Google button, ...
│       ├── pages/                # Login, Signup, Dashboard, Chat, Quiz, KnowledgeGraph, Workspaces, WorkspaceDetail, Analytics
│       └── utils/exportUtils.js  # PDF / Markdown export
└── docs/screenshots/
```

---

## Running it locally

### Prerequisites

- **Node.js 20+**
- **A Gemini API key**: free from [Google AI Studio](https://aistudio.google.com/apikey)
- **PostgreSQL with pgvector**. Pick one:
  - **Easiest: a free cloud database.** Create a project on [Neon](https://neon.tech) or [Supabase](https://supabase.com) (both include pgvector) and copy its connection string. Nothing to install.
  - **Docker:** `docker run -d --name docchat-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ragdoc -p 5432:5432 pgvector/pgvector:pg16`
  - **Your own PostgreSQL:** install the pgvector extension ([instructions](https://github.com/pgvector/pgvector#installation)). On Windows this needs a C build toolchain, so the cloud option is much simpler.

### 1. Backend

```bash
cd backend
cp .env.example .env        # on Windows: copy .env.example .env
```

Edit `backend/.env`:

> **Neon tip:** in the **Connect** dialog, click **Show password** before copying, so the string contains the real password instead of `********`.

```env
# Either a connection string (Neon / Supabase) ...
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
# ... or local settings: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

JWT_SECRET=any-long-random-string
GEMINI_API_KEY=your-key
```

```bash
npm install
npm run dev                 # http://localhost:5000
```

On the first start the server creates the tables and enables pgvector. If you used an earlier version that stored vectors in `backend/data/vectors/`, they are copied into PostgreSQL automatically.

### 2. Frontend

```bash
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:5000
npm install
npm run dev                 # http://localhost:5173
```

Open http://localhost:5173, create an account and upload a document.

---

## Deployment

A free setup: **Neon** (database) + **Render** (backend) + **Vercel** (frontend).

### 1. Database: Neon
1. Create a project at [neon.tech](https://neon.tech).
2. Copy the connection string (it ends with `?sslmode=require`).

### 2. Backend: Render
1. New → **Web Service** → connect this GitHub repository.
2. **Root directory:** `backend` · **Build command:** `npm install` · **Start command:** `npm start`
3. **Environment variables:** `DATABASE_URL`, `JWT_SECRET`, `GEMINI_API_KEY`, and `CORS_ORIGIN` (your Vercel URL, added after step 3).
4. Deploy and note the URL, e.g. `https://docchat-api.onrender.com`. Check `https://…/health` returns `{"status":"ok"}`.

### 3. Frontend: Vercel
1. New Project → import this repository.
2. **Root directory:** `frontend` (Vite is detected automatically).
3. **Environment variable:** `VITE_API_URL` = your Render URL.
4. Deploy, then put the Vercel URL into `CORS_ORIGIN` on Render and redeploy the backend.

### Things to know
- **Free Render services sleep** after a period without traffic; the first request afterwards takes a while. Open the site a minute before a demo.
- **Uploaded original files live on the server's disk**, which free hosts wipe on restart. Everything needed to chat, quiz and summarise (text and embeddings) is in PostgreSQL, so documents keep working; only *Retry* on a failed upload needs the original file.
- **A public demo uses your Gemini quota.** Consider a demo account, or limits per user.

---

## Configuration

`backend/.env`

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | one of these | Full connection string (Neon, Supabase, Render) |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | | Local PostgreSQL settings |
| `DB_SSL` | no | `true` to force SSL with the `DB_*` settings |
| `DB_SSL_REJECT_UNAUTHORIZED` | no | `false` only if your database's SSL certificate can't be verified (not needed for Neon) |
| `JWT_SECRET` | yes | Secret for signing session tokens |
| `GEMINI_API_KEY` | yes | Google AI Studio key |
| `GEMINI_MODELS` | no | Comma-separated model fallback order |
| `GEMINI_THINKING` | no | `default` to let models use their default thinking level (slower) |
| `SUMMARY_CONCURRENCY` | no | Parallel section summaries for long documents (default 4; lower if you hit rate limits) |
| `GOOGLE_CLIENT_ID` | no | Enables Google sign-in |
| `CORS_ORIGIN` | no | Allowed frontend origin(s), comma-separated (default `http://localhost:5173`) |
| `PORT` | no | Default `5000` |

`frontend/.env`

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend URL |
| `VITE_GOOGLE_CLIENT_ID` | Same as `GOOGLE_CLIENT_ID`; the Google button is hidden without it |

---

## Design decisions

**Why RAG instead of sending the whole document to the model?** Sending only the 4 most relevant passages keeps prompts small (faster, cheaper, within limits for long documents), and lets every answer show exactly which passages it used.

**Chunk size 2,000 characters with 200 overlap.** Big enough to hold a complete idea, small enough that the top 4 fit comfortably in a prompt. The overlap means a sentence cut at a boundary still appears whole in one of the two chunks. Chunks never cross page boundaries, so every chunk has one page number for citations.

**pgvector instead of a separate vector database.** The text, page numbers, ownership and embeddings sit in the same row, so one SQL query can filter by user/document and rank by similarity, and deleting a document deletes its vectors in the same transaction. No second service to run or keep in sync.

**Exact search instead of an approximate index (HNSW).** Search always filters to one user's documents first, which is at most a few thousand rows, and PostgreSQL ranks those by exact cosine distance in milliseconds. Approximate indexes help when searching millions of rows, but combined with a `WHERE` filter they can return fewer than *k* results on older pgvector versions. At this scale exact is simpler and always correct. (Scaling up: add `CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)` with pgvector 0.8's iterative scans, using `halfvec` since HNSW indexes support up to 2,000 dimensions for `vector`.)

**Cosine similarity.** It compares the direction of two vectors, not their length, which is the standard measure for text embeddings.

**Background processing.** Upload returns `202 Accepted` immediately; extraction and embedding happen afterwards and the dashboard shows the status. Large files don't block the request.

**Streaming over Server-Sent Events.** One-way server-to-browser text over plain HTTP, simpler than WebSockets for this job.

**Security.** Passwords hashed with bcrypt; JWTs signed with a server secret; Google sign-in accepted only with a verified ID token; every query filtered by `user_id`; route IDs validated as UUIDs; uploaded files stored under random names; CORS limited to the frontend's origin; model output rendered as React elements (never as raw HTML).

---

## Limitations and next steps

- Scanned PDFs (images of text) have no extractable text; adding OCR would fix that.
- Quality depends on retrieval: if the right passage isn't in the top 4, the answer will say it doesn't know. Hybrid search (keywords + vectors) or a re-ranking step would help.
- No automated evaluation of answer quality yet (e.g. a set of known questions and expected pages).
- Uploaded originals are on local disk; object storage (S3, Cloudinary) would make them survive redeploys.
- Rate limiting per user for a public deployment.

---

## Author

**Shubham Gabhane** ([@shubhamgabhane1104](https://github.com/shubhamgabhane1104)) — MCA mini project.

<!-- Add your LinkedIn / portfolio links here -->
