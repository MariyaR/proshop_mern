Ran it locally using Docker (MongoDB) + npm run dev

Fixed empty cart bug in PlaceOrderScreen — commit 048e3b7

ADRs 0001–0003 (docs/adr/) were created with Claude Sonnet. ADRs 0004–0006 were created with Claude Opus.

## RAG Stack

For this exercise I used Qdrant as the vector database and BAAI/bge-m3 as the embedding model, as shown in the video. The goal was to understand the basic principle of building a RAG system rather than going deep into every detail, since time is always limited.

The most difficult part for me is that I still do not fully understand how to test a RAG system and how to debug and improve it when the retrieval quality is not good enough. The lecture mentioned some techniques like trying different models or varying the chunk size, which I found interesting. I would like to explore this topic further but need more time to practice.

## Qdrant RAG Test Queries (BAAI/bge-m3, collection: project-docs, top 3)

### Q1: Какая БД используется в proshop_mern и почему именно она?

| # | Score | Source | Section |
|---|-------|--------|---------|
| 1 | 0.6449 | best-practices.md | 1. Introduction: Why proshop_mern Is Deprecated |
| 2 | 0.6448 | architecture.md | 1. System Overview |
| 3 | 0.6349 | feature-flags-spec.md | Feature Flags in This Project |

Note: `adrs/adr-001-mongodb-vs-postgres.md` (the most relevant doc) did not appear in top 3. Likely cause: Russian query vs English docs — consider querying in English or filtering by `category: "adr"`.

---

### Q2: Какие фичи зависят от payment_stripe_v3?

| # | Score | Source | Section |
|---|-------|--------|---------|
| 1 | 0.6888 | adrs/adr-004-paypal-vs-stripe.md | Stripe |
| 2 | 0.6585 | adrs/adr-004-paypal-vs-stripe.md | Migration Path |
| 3 | 0.6222 | adrs/adr-004-paypal-vs-stripe.md | Current Assessment (April 2026) |

Note: `payment_stripe_v3` does not exist in the knowledge base. All results from the same file — expected behavior for an unknown flag. Project uses PayPal, not Stripe.

---

### Q3: Что случилось во время последнего incident с checkout?

| # | Score | Source | Section |
|---|-------|--------|---------|
| 1 | 0.6226 | runbooks/incident-response.md | Customer Communication (If >5 min downtime) |
| 2 | 0.6180 | runbooks/incident-response.md | Timeline |
| 3 | — | — | — |

Note: Query returned runbook template instead of actual incident files (`incidents/`). Fix: add `category: "incident"` filter to query.

## MCP Configuration: Wrong Location Issue

Initially placed the MCP server definitions inside `.claude/settings.json` under `mcpServers`. The servers did not appear in Claude Code and the tools were not available. After some investigation, the correct location for project-level MCP configuration in Claude Code is a separate `.mcp.json` file at the project root — not inside `.claude/settings.json`.

Moving the configuration to `.mcp.json` resolved the issue and the tools became available immediately on reconnect.
