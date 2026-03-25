# MemoryBench Integration Guide

This document explains how MemoryBench works and how it integrates with the Memsy memory library.

## What is MemoryBench?

[MemoryBench](https://github.com/supermemoryai/memorybench) is an open-source benchmarking framework for evaluating memory and conversational context systems. It provides standardized datasets and evaluation pipelines to compare different memory providers.

### Key Features

- **Interoperable**: Mix and match any provider with any benchmark
- **Checkpointed runs**: Resume from any pipeline stage
- **Multi-provider comparison**: Evaluate providers side-by-side
- **Judge-agnostic**: Use GPT-4o, Claude, Gemini, etc.

## Pipeline Stages

MemoryBench runs a 6-stage evaluation pipeline:

```
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌──────────┐   ┌─────────┐
│ INGEST  │ → │ INDEX   │ → │ SEARCH  │ → │ ANSWER  │ → │ EVALUATE │ → │ REPORT  │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └──────────┘   └─────────┘
```

| Stage | Description |
|-------|-------------|
| **Ingest** | Load benchmark sessions → Push to memory provider |
| **Index** | Wait for provider to finish indexing/processing |
| **Search** | Query provider with test questions → Get context |
| **Answer** | Build prompt with context → Generate answer via LLM |
| **Evaluate** | Compare answer to ground truth → Score via judge model |
| **Report** | Aggregate scores → Output accuracy + latency metrics |

## Supported Benchmarks

| Benchmark | Description |
|-----------|-------------|
| `locomo` | LoCoMo - Long-context conversational memory |
| `longmemeval` | LongMemEval - Extended memory evaluation |
| `convomem` | ConvoMem - Conversational memory tasks |

---

## Memsy Integration Architecture

Since MemoryBench is TypeScript and Memsy is Python, we use an HTTP bridge:

```
┌───────────────────────────┐       HTTP        ┌───────────────────────────┐
│     MemoryBench (Bun)     │ ◄───────────────► │    Memsy HTTP API         │
│                           │                   │    (FastAPI/Uvicorn)      │
│  ┌─────────────────────┐  │                   │  ┌─────────────────────┐  │
│  │  MemsyProvider      │  │   POST /ingest    │  │  memsy.add()        │  │
│  │  (TypeScript)       │──┼──────────────────►│  │                     │  │
│  │                     │  │   POST /search    │  │  memsy.retrieve()   │  │
│  │                     │◄─┼───────────────────┤  │                     │  │
│  └─────────────────────┘  │   POST /status    │  │  is_memory_processed│  │
│                           │   DELETE /clear   │  │  clear_by_user()    │  │
└───────────────────────────┘                   └───────────────────────────┘
```

### Provider Interface

Each MemoryBench provider must implement:

```typescript
interface Provider {
  name: string
  initialize(config: ProviderConfig): Promise<void>
  ingest(sessions: UnifiedSession[], options: IngestOptions): Promise<IngestResult>
  awaitIndexing(result: IngestResult, containerTag: string): Promise<void>
  search(query: string, options: SearchOptions): Promise<unknown[]>
  clear(containerTag: string): Promise<void>
}
```

### Mapping to Memsy

| Provider Method | HTTP Endpoint | Memsy Method |
|-----------------|---------------|--------------|
| `initialize()` | `GET /health` | Connection check |
| `ingest()` | `POST /ingest` | `memsy.add()` |
| `awaitIndexing()` | `POST /status` | `is_memory_processed()` |
| `search()` | `POST /search` | `memsy.retrieve()` |
| `clear()` | `DELETE /clear/{tag}` | `clear_by_user()` |

---

## Files Created

### Python (Memsy HTTP API)

| File | Purpose |
|------|---------|
| `memsy/api/api.py` | FastAPI application with endpoints |
| `memsy/api/schemas.py` | Pydantic models matching MemoryBench types |

### TypeScript (MemoryBench Provider)

| File | Purpose |
|------|---------|
| `memorybench/src/providers/memsy/index.ts` | Provider implementation |
| `memorybench/src/providers/memsy/prompts.ts` | Custom prompts for evaluation |

### Modified Files

| File | Changes |
|------|---------|
| `memsy/memory/memsy.py` | Added `clear_by_user()`, `is_memory_processed()` |
| `memsy/memory/processor.py` | Store `raw_memory_id` in metadata |
| `memorybench/src/providers/index.ts` | Register MemsyProvider |
| `memorybench/src/types/provider.ts` | Add "memsy" to ProviderName |
| `memorybench/src/utils/config.ts` | Add `memsyApiUrl` config |

---

## Running a Benchmark

### Prerequisites

1. PostgreSQL with `pgvector` extension
2. Redis
3. OpenAI API key (for embeddings + evaluation)

### Start Services

```bash
# Terminal 1: Start infrastructure
cd /path/to/memsy
docker-compose up -d

# Terminal 2: Start Memsy API
export OPENAI_API_KEY=your-key
export DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/memory_db
export REDIS_URL=redis://localhost:6379/0
.venv/bin/uvicorn memsy.api.api:app --host 0.0.0.0 --port 8000

# Terminal 3: Run benchmark
cd /path/to/memorybench
MEMSY_API_URL=http://localhost:8003 bun run src/index.ts run -p memsy -b locomo -l 10
```

### Command Options

```bash
bun run src/index.ts run \
  -p memsy              # Provider name
  -b locomo             # Benchmark dataset
  -j gpt-4o             # Judge model for evaluation
  -m gpt-4o             # Answering model
  -l 10                 # Limit to N questions
  -r my-run-id          # Custom run identifier
  --force               # Restart from scratch (ignore checkpoint)
```

### Compare Providers

```bash
bun run src/index.ts compare \
  -p memsy,supermemory,mem0 \
  -b locomo \
  -s 5  # Sample size
```

---

## Data Flow Example

**1. Ingest Phase**
```
MemoryBench loads LoCoMo dataset
    ↓
Converts to UnifiedSession[] format
    ↓
POST /ingest to Memsy API
    ↓
Memsy stores raw text → Queues for async processing
    ↓
Workers extract episodic/semantic/procedural memories
```

**2. Search Phase**
```
MemoryBench sends question: "What is John's job?"
    ↓
POST /search to Memsy API
    ↓
Memsy runs hybrid search (vector + keyword)
    ↓
Optional: Cohere reranking
    ↓
Returns top-K memories with scores
```

**3. Evaluate Phase**
```
MemoryBench builds prompt with search results
    ↓
LLM generates answer
    ↓
Judge model compares answer to ground truth
    ↓
Score: CORRECT or INCORRECT with explanation
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `OPENAI_API_KEY required` | Export the key: `export OPENAI_API_KEY=...` |
| `Connection refused :8000` | Start the Memsy API server first |
| `Unknown provider: memsy` | Ensure config.ts has the memsy case |
| Slow indexing | Increase worker count in MemsyConfig |

---

## References

- [MemoryBench GitHub](https://github.com/supermemoryai/memorybench)
- [MemoryBench Documentation](https://supermemory.ai/docs/memorybench/overview)
- [Memsy README](./README.md)
