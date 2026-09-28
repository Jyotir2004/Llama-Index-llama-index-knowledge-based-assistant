import os
from pathlib import Path
from typing import List

import chromadb
from dotenv import load_dotenv
from docx import Document as DocxDocument
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader

from llama_index.core import Document, Settings, StorageContext, VectorStoreIndex
from llama_index.embeddings.openai import OpenAIEmbedding
from llama_index.llms.openai import OpenAI
from llama_index.vector_stores.chroma import ChromaVectorStore

BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
CHROMA_DIR = BASE_DIR / "chroma_db"
ALLOWED_EXTS = {".pdf", ".txt", ".docx", ".csv", ".json", ".md"}

load_dotenv(BASE_DIR / ".env")

app = FastAPI(title="LlamaIndex RAG App")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.chat_history: List[dict] = []
app.state.index = None

UPLOAD_DIR.mkdir(exist_ok=True, parents=True)
CHROMA_DIR.mkdir(exist_ok=True, parents=True)


def get_groq_api_key() -> str:
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise RuntimeError("GROQ_API_KEY is missing. Add it to the .env file.")
    return key


def extract_text_from_file(file_path: Path) -> str:
    suffix = file_path.suffix.lower()

    try:
        if suffix in {".txt", ".md", ".json", ".csv"}:
            return file_path.read_text(encoding="utf-8", errors="ignore")

        if suffix == ".pdf":
            reader = PdfReader(str(file_path))
            pages = [page.extract_text() or "" for page in reader.pages]
            return "\n".join(pages)

        if suffix == ".docx":
            doc = DocxDocument(str(file_path))
            return "\n".join(paragraph.text for paragraph in doc.paragraphs)
    except Exception:
        return ""

    return ""


def get_openai_api_key() -> str | None:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        return None
    if key.startswith("gsk_"):
        raise RuntimeError(
            "OPENAI_API_KEY appears to contain a Groq key. "
            "Use a real OpenAI API key from https://platform.openai.com/account/api-keys for text-embedding-3-small."
        )
    return key


def get_embedding_model():
    openai_key = get_openai_api_key()
    if openai_key:
        return OpenAIEmbedding(
            model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"),
            api_key=openai_key,
        )

    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        raise RuntimeError(
            "OPENAI_API_KEY is required for text-embedding-3-small. "
            "The current Groq key does not expose embedding models, so set OPENAI_API_KEY in .env "
            "or choose a Groq-supported embedding model in EMBEDDING_MODEL."
        )

    raise RuntimeError("No API key available for embeddings. Set OPENAI_API_KEY or GROQ_API_KEY.")


def get_llm():
    model_name = os.getenv("GROQ_LLM_MODEL", "openai/gpt-oss-120b")
    return OpenAI(
        model=model_name,
        api_key=get_groq_api_key(),
        api_base="https://api.groq.com/openai/v1",
        temperature=0.1,
    )


def get_chroma_collection():
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return client.get_or_create_collection(name="rag_documents")


def build_index_from_uploads() -> VectorStoreIndex:
    if not UPLOAD_DIR.exists():
        UPLOAD_DIR.mkdir(exist_ok=True, parents=True)

    files = [p for p in UPLOAD_DIR.iterdir() if p.is_file() and p.suffix.lower() in ALLOWED_EXTS]
    if not files:
        raise ValueError("No supported files found in uploads folder.")

    Settings.embed_model = get_embedding_model()
    Settings.llm = get_llm()

    documents = []
    for file_path in files:
        text = extract_text_from_file(file_path)
        if text.strip():
            documents.append(
                Document(
                    text=text,
                    metadata={"file_name": file_path.name},
                )
            )

    if not documents:
        raise ValueError("No readable document content was found in uploads folder.")

    chroma_collection = get_chroma_collection()
    stored_ids = chroma_collection.get().get("ids") or []
    if stored_ids:
        chroma_collection.delete(ids=stored_ids)

    vector_store = ChromaVectorStore(chroma_collection=chroma_collection)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    index = VectorStoreIndex.from_documents(
        documents,
        storage_context=storage_context,
        show_progress=True,
    )
    app.state.index = index
    return index


def ensure_index():
    if app.state.index is None:
        try:
            return build_index_from_uploads()
        except ValueError:
            return None
    return app.state.index


@app.get("/api/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/files")
def list_files():
    files = [p.name for p in sorted(UPLOAD_DIR.glob("*")) if p.is_file() and p.suffix.lower() in ALLOWED_EXTS]
    return {"files": files}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    if file.filename is None:
        raise HTTPException(status_code=400, detail="No file selected.")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Allowed: PDF, TXT, DOCX, CSV, JSON, MD.",
        )

    target_path = UPLOAD_DIR / file.filename
    with target_path.open("wb") as buffer:
        content = await file.read()
        buffer.write(content)

    try:
        build_index_from_uploads()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Index build failed: {exc}") from exc

    return {"message": f"Uploaded and indexed: {file.filename}", "filename": file.filename}


@app.post("/api/query")
async def query_rag(payload: dict):
    question = str(payload.get("question", "")).strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    index = ensure_index()
    if index is None:
        return {
            "answer": "I don't have any information loaded yet. Please upload a document first.",
            "context": [],
        }

    retriever = index.as_retriever(similarity_top_k=4)
    nodes = retriever.retrieve(question)
    context_texts = [node.get_content() for node in nodes]

    if not context_texts:
        answer = "I don't have any information about this. Please ask something else."
        return {"answer": answer, "context": []}

    history = app.state.chat_history[-5:]
    history_text = "\n".join(f"Q: {h['question']}\nA: {h['answer']}" for h in history)
    system_prompt = (
        "You are a helpful assistant. Answer using only the provided context. "
        "If the answer is not found in the uploaded documents, reply exactly: "
        "I don't have any information about this. Please ask something else."
    )
    if history_text:
        system_prompt += f"\n\nConversation memory:\n{history_text}"

    llm = get_llm()
    context = "\n\n---\n\n".join(context_texts)
    prompt = f"{system_prompt}\n\nContext:\n{context}\n\nQuestion: {question}"
    answer = str(llm.complete(prompt).text).strip()

    app.state.chat_history.append({"question": question, "answer": answer})
    return {"answer": answer, "context": context_texts}


@app.get("/api/memory")
def get_memory():
    return {"memory": app.state.chat_history}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
