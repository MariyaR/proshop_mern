#!/usr/bin/env python3
"""
Ingest project-data markdown files into Qdrant using BAAI/bge-m3.
Run: python3 ingest.py
"""
import re
from pathlib import Path
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from sentence_transformers import SentenceTransformer

QDRANT_URL = "http://localhost:6333"
COLLECTION = "project-docs"
VECTOR_SIZE = 1024
BATCH_SIZE = 50
MIN_CHUNK_LENGTH = 50


def get_category(file_path: str) -> str:
    if '/adrs/' in file_path:      return 'adr'
    if '/incidents/' in file_path: return 'incident'
    if '/runbooks/' in file_path:  return 'runbook'
    if '/api/' in file_path:       return 'api'
    if '/pages/' in file_path:     return 'page'
    if '/features/' in file_path:  return 'feature'
    return 'core'


def chunk_markdown(text: str):
    lines = text.split('\n')
    title = ''
    current_section = ''
    current_lines = []
    chunks = []

    def flush():
        content = '\n'.join(current_lines).strip()
        if len(content) >= MIN_CHUNK_LENGTH:
            chunks.append({'section': current_section, 'text': content})
        current_lines.clear()

    for line in lines:
        if re.match(r'^# ', line):
            title = re.sub(r'^# ', '', line).strip()
            current_lines.append(line)
        elif re.match(r'^#{2,3} ', line):
            flush()
            current_section = re.sub(r'^#{2,3} ', '', line).strip()
            current_lines.append(line)
        else:
            current_lines.append(line)
    flush()

    return title, chunks


def main():
    base_dir = Path(__file__).parent

    print("Loading BAAI/bge-m3 model (first run downloads ~1.1 GB)...")
    model = SentenceTransformer('BAAI/bge-m3')
    print("Model ready\n")

    client = QdrantClient(url=QDRANT_URL)

    existing = [c.name for c in client.get_collections().collections]
    if COLLECTION in existing:
        print(f'Collection "{COLLECTION}" exists — recreating')
        client.delete_collection(COLLECTION)

    client.create_collection(
        collection_name=COLLECTION,
        vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
    )
    print(f'Collection "{COLLECTION}" created\n')

    files = sorted(
        f for f in base_dir.rglob('*.md')
        if 'node_modules' not in f.parts
    )
    print(f"Found {len(files)} markdown files\n")

    points = []
    point_id = 0

    for file in files:
        relative = str(file.relative_to(base_dir))
        content = file.read_text(encoding='utf-8')
        category = get_category(str(file))
        title, chunks = chunk_markdown(content)

        print(f"  {relative} → {len(chunks)} chunks")

        for i, chunk in enumerate(chunks):
            text = chunk['text']
            vector = model.encode(text, normalize_embeddings=True).tolist()

            points.append(PointStruct(
                id=point_id,
                vector=vector,
                payload={
                    'text': text,
                    'source': relative,
                    'category': category,
                    'title': title or file.stem,
                    'section': chunk['section'],
                    'chunk_index': i,
                }
            ))
            point_id += 1

    print(f"\nUpserting {len(points)} points in batches of {BATCH_SIZE}...")
    for i in range(0, len(points), BATCH_SIZE):
        batch = points[i:i + BATCH_SIZE]
        client.upsert(collection_name=COLLECTION, points=batch)
        print(f"  {min(i + BATCH_SIZE, len(points))}/{len(points)} done")

    print(f"\nIngestion complete — {len(points)} points in collection '{COLLECTION}'")


if __name__ == '__main__':
    main()
