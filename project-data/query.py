#!/usr/bin/env python3
"""
Query project-docs collection in Qdrant using BAAI/bge-m3.
Usage: python3 query.py "your question here"
"""
import sys
from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer

QDRANT_URL = "http://localhost:6333"
COLLECTION = "project-docs"
TOP_K = 5

if len(sys.argv) < 2:
    print("Usage: python3 query.py \"your question\"")
    sys.exit(1)

query = " ".join(sys.argv[1:])

model = SentenceTransformer('BAAI/bge-m3')
client = QdrantClient(url=QDRANT_URL)

vector = model.encode(query, normalize_embeddings=True).tolist()
results = client.search(
    collection_name=COLLECTION,
    query_vector=vector,
    limit=TOP_K,
    with_payload=True,
)

for i, r in enumerate(results, 1):
    p = r.payload
    print(f"[{i}] score={r.score:.4f} | {p['source']} › {p['section']}")
    print(p['text'][:400].strip())
    print()
