#!/usr/bin/env python3
"""
MCP server for searching ProShop MERN project documentation.
Queries the project-docs Qdrant collection using BAAI/bge-m3 embeddings.

Run:  python3 backend/mcp_docs.py
"""
from fastmcp import FastMCP

QDRANT_URL = "http://localhost:6333"
COLLECTION = "project-docs"

mcp = FastMCP("project-docs")

_model = None
_client = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("BAAI/bge-m3")
    return _model


def _get_client():
    global _client
    if _client is None:
        from qdrant_client import QdrantClient
        _client = QdrantClient(url=QDRANT_URL)
    return _client


@mcp.tool()
def search_project_docs(query: str, top_k: int = 5) -> list:
    """
    Search for information about the proshop_mern product — architecture, features, ADRs,
    runbooks, incidents, glossary, dev history.
    You MUST call this FIRST when the user asks about product functionality, design decisions,
    historical context, or past incidents.

    Do NOT call this for the current state of feature flags — for that, use the separate
    feature-flags MCP get_feature_info tool.

    Returns a ranked list of matching document chunks, each with source, category, title,
    section, score, and a short snippet (~200 characters).
    """
    try:
        vector = _get_model().encode(query, normalize_embeddings=True).tolist()
        response = _get_client().query_points(
            collection_name=COLLECTION,
            query=vector,
            limit=top_k,
            with_payload=True,
        )
        return [
            {
                "source": r.payload["source"],
                "category": r.payload["category"],
                "title": r.payload["title"],
                "section": r.payload["section"],
                "score": round(r.score, 4),
                "snippet": r.payload["text"][:200].strip(),
            }
            for r in response.points
        ]
    except Exception as exc:
        return [{"error": str(exc)}]


if __name__ == "__main__":
    mcp.run()
