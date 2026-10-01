# Llama Index Knowledge Hub

An end-to-end Retrieval-Augmented Generation (RAG) platform built with **LlamaIndex**, **FastAPI**, **ChromaDB**, **Hugging Face Inference API**, **Groq LLM**, and a modern **React + Vite** frontend.

---

## Features

- **Document Ingestion**: Upload documents in PDF, DOCX, TXT, CSV, JSON, or MD formats.
- **Raw Data Editor**: Create, write, or paste text notes directly into `.txt` files that are automatically chunked and indexed into the vector store.
- **Semantic Vector Search**: Embeds content using `sentence-transformers/all-MiniLM-L6-v2` via Hugging Face Inference API into a persistent ChromaDB vector store.
- **Context-Grounded Answers**: Uses Groq LLMs (e.g. `openai/gpt-oss-120b` or Llama 3) for fast, accurate question answering grounded strictly in your indexed documents and notes.
- **In-App Content Preview**: View raw text and document contents directly with the modal viewer.
- **Modern Responsive UI**: Built with React 18 and Material-UI with dark mode, real-time typing indicators, and keyboard shortcuts (`Enter` to submit).

---

## Project Structure

```
llama_index/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   └── main.py          # FastAPI application & LlamaIndex RAG pipeline
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Knowledge Hub & chat UI
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js       # Vite dev server with /api proxy
├── uploads/                 # Local document & raw text storage
├── chroma_db/               # Persistent Chroma vector store
├── .env.example             # Configuration template
└── README.md
```

---

## Getting Started

### 1. Prerequisites

- Python 3.10+
- Node.js 18+ and npm

### 2. Environment Configuration

Copy `.env.example` to `.env` in the root directory:

```bash
cp .env.example .env
```

Set your API keys in `.env`:

```env
HF_TOKEN=your_huggingface_token_here
HF_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
GROQ_API_KEY=your_groq_api_key_here
GROQ_LLM_MODEL=openai/gpt-oss-120b
```

### 3. Backend Setup

```bash
# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate       # Windows
# source venv/bin/activate  # macOS / Linux

# Install dependencies
pip install -r backend/requirements.txt

# Run backend server
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

The backend API will be available at `http://127.0.0.1:8000` (API docs at `http://127.0.0.1:8000/docs`).

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

The application will be accessible at `http://127.0.0.1:5173`.
