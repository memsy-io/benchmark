# Benchmark Comparison Analysis

**Date:** January 13, 2026
**Subject:** Memsy V2 vs. SOTA Competitors (Zep, Mem0, Supermemory)

## Executive Summary

Memsy V2 has made significant strides in ingestion throughput, bringing it into the "production-ready" tier. However, compared to specialized commercial providers (Zep, Mem0), Memsy currently trails in **Recall Accuracy** (~10-15% gap) and **Search Latency** (~2x slower).

The primary differentiator for the segment leaders is their adoption of **Knowledge Graphs** (Graph RAG) alongside Vector Search. Memsy's current architecture is **Hybrid (Vector + Lexical)**, which explains the accuracy ceiling.

---

## 1. The Landscape (LoCoMo Benchmark)

| Provider | Accuracy / Recall | Search Latency (p95) | Architecture | Target Use Case |
| :--- | :--- | :--- | :--- | :--- |
| **Zep** | **75.1%** | **< 200ms** | Temporal Knowledge Graph | Production Agents (Ent) |
| **Supermemory** | **SOTA** (LongMemEval) | **~100ms** | Graph + Vector Engine | High-Scale Apps |
| **Mem0 (Graph)** | **68.4%** | **~150ms** | Graph + Vector | General Purpose |
| **MemGPT (Letta)** | **92%** (DMR) | High (>2s) | OS / Virtual Context | Complex Personas / RP |
| **Memsy V2** | 60.0% | ~400ms | Hybrid (Vector + Keyword) | **Self-Hosted / Mid-Market** |
| **LangChain (LangMem)** | N/A (SDK only) | Variable | SDK Primitives | Devs building custom memory |
| **Motorhead** | N/A | **< 50ms** | Pure Rust Server | Speed-critical / Simple |
| **OpenAI Memory** | 52.9% | N/A | Vector (Simple) | Basic Chatbots |

### Key Observations & Market Segmentation
1.  **The "Graph Tier" (Zep, Supermemory, Mem0):** These are the current market leaders for production agents. They use Knowledge Graphs to solve complex reasoning (temporal, multi-hop) and achieve sub-200ms latency.
2.  **The "Deep Context" Tier (MemGPT):** MemGPT achieves massive accuracy (90%+) by treating memory as an OS with infinite context, but at the cost of significantly higher latency. It is ideal for roleplay/personas but too slow for real-time RAG.
3.  **The "Speed" Tier (Motorhead):** Fast Rust backend, but lacks the "cognitive" features (Graph/Reasoning) of the leaders.
4.  **Memsy's Position:** Memsy V2 sits in the "Self-Hosted / Mid-Market" sweet spot. It is smarter than raw stores (Motorhead) and OpenAI, but lacks the graph sophistication of Zep/Supermemory.

---

## 2. Feature Gap Analysis

### Gap 1: Knowledge Graph (The Accuracy Driver)

*   **Competitors:** Zep (Graphiti) and Mem0 use graph structures to link `User -> employs -> Tool` or `Project -> deadline -> Date`. This allows them to answer *"What tools does the engineering team use?"* by traversing the graph.
*   **Memsy:** Uses pure semantic text matching. We might find "kubectl" if the user searches "tools", but we miss implicit connections that aren't textually adjacent.
*   **Improvement Opportunity:** Implement a "Entity Relation" extraction worker to build a lightweight graph in Postgres (recursive CTEs).

### Gap 2: Temporal Reasoning

*   **Competitors:** Zep excels at "What did we discuss *last week*?" by treating Time as a first-class graph node.
*   **Memsy:** Only filters by `created_at`. We lack understanding of relative time ("last week", "after the release").
*   **Improvement Opportunity:** Add a metadata extractor for relative time expressions.

### Gap 3: Search Latency

*   **Competitors:** ~150ms. Likely achieving this by caching embeddings or using in-memory vector stores (Qdrant/Milvus) rather than Postgres (pgvector).
*   **Memsy:** ~350-400ms. Postgres is robust but strict.
*   **Improvement Opportunity:**
    1.  Keep Postgres for durability.
    2.  Add a Redis cache for frequent queries.
    3.  Consider moving the hot vector index to Qdrant if <200ms is a hard requirement.

---

## 3. Strategic Recommendations

To close the gap with Zep/Mem0, Memsy should evolve from **V2 (Hybrid)** to **V3 (Graph-Hybrid)**.

### Immediate Wins (Phase 1)
1.  **Refine Extraction Prompts:** Our current 60% is largely due to prompt tuning. We can likely squeeze another 3-5% by specifically targeting "relationships" in the System Prompt.
2.  **Reranking:** Implement a Cross-Encoder Reranker step. This would boost MRR significantly (at the cost of latency), possibly pushing us to 65% recall.

### Architectural Evolution (Phase 2)
1.  **Graph Table:** Add `memsy_relations` (from_id, to_id, relation_type).
2.  **Graph Worker:** A new worker type that specifically looks for connections between existing memories.
3.  **Graph Traversal Search:** logic to walk 1-hop neighbors during retrieval.

## Conclusion

Memsy V2 is a solid "Mid-Market" contender. It is faster and smarter than basic vector memory (LangChain/OpenAI default) but hasn't yet reached the "SOTA" tier of Zep/Mem0 because it lacks a Knowledge Graph. For a self-hosted, Postgres-backed solution, it provides excellent value, but for complex reasoning tasks, the lack of graph structure is the primary limiter.
