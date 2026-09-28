from pathlib import Path
import os

from dotenv import load_dotenv
from llama_index.core import MockEmbedding, SimpleDirectoryReader, VectorStoreIndex, Settings
from llama_index.llms.groq import Groq

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"

load_dotenv(BASE_DIR / ".env")


def build_index(data_dir: Path = DATA_DIR) -> VectorStoreIndex:
    data_dir.mkdir(exist_ok=True)

    if not any(data_dir.iterdir()):
        (data_dir / "sample.txt").write_text(
            "LlamaIndex is a library for building retrieval-augmented generation (RAG) applications. "
            "It can ingest documents, build indexes, and answer user questions from the indexed content.",
            encoding="utf-8",
        )

    documents = SimpleDirectoryReader(str(data_dir)).load_data()
    print(f"Loaded {len(documents)} document(s).")

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "Missing GROQ_API_KEY. Add it to the .env file in the project root or export it in your environment."
        )

    llm = Groq(model="openai/gpt-oss-120b", api_key=api_key)
    Settings.llm = llm
    Settings.embed_model = MockEmbedding(embed_dim=1536)

    return VectorStoreIndex.from_documents(documents)


def ask_question(index: VectorStoreIndex, question: str):
    query_engine = index.as_query_engine(similarity_top_k=2)
    return query_engine.query(question)


def main() -> None:
    index = build_index()
    print("\nRAG chatbot ready!")
    print("Type 'exit' to quit.\n")

    while True:
        question = input("You: ")

        if question.lower() in ["exit", "quit", "q"]:
            break

        if not question.strip():
            continue

        response = ask_question(index, question)
        print("\nAI:", response)
        print()


if __name__ == "__main__":
    main()