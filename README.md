# 🚀 Memsy Benchmark

This directory contains the tools and instructions for benchmarking **Memsy's** performance using [supermemory's `memorybench`](https://github.com/supermemoryai/memorybench). This repository is used to set up the environment, inject Memsy providers into the benchmark suite, and evaluate its retrieval capabilities.

## 📋 Overview

The benchmark suite evaluates Memsy across several critical dimensions.

### Integration
This setup automatically:
1. Clones the `memorybench` repository.
2. Injects the Memsy-specific adapter (`benchmark/adapter/`).
3. Patches `memorybench` to register Memsy as a supported provider.
4. Installs all required dependencies.

---

## 🛠️ Prerequisites

Before you begin, ensure you have the following installed:

- **[Bun](https://bun.sh/)** v1.0+ (required for `memorybench`):
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
- **[Docker](https://www.docker.com/)**: To run infrastructure services (Postgres, Redis, Milvus).
- **OpenAI API Key**: Required for embeddings and the evaluation judge.

---

## 📊 Running the Benchmark

### 1. External Infrastructure
Ensure all Memsy backend services are running. From the **root** directory:
```bash
docker-compose up -d
```

### 2. Environment Configuration
Create or update your `.env` file in the root directory:
```bash
# Required for Memsy & Evaluation
OPENAI_API_KEY=sk-...
DATABASE_URL=postgresql://user:password@localhost:5432/memory_db

# Memsy API URL (used by the runner)
MEMSY_API_URL=http://localhost:8003
```

### 3. One-time Setup
Run the setup script from the **root** directory to clone and patch `memorybench`:
```bash
./benchmark/setup.sh
```

### 4. Start Memsy API
Ensure the Memsy HTTP API is running:
```bash
uv run uvicorn memsy.http.api:app --host 0.0.0.0 --port 8003 --reload
```

### 5. Run the Benchmarks
Use the provided wrapper script to execute tests:
```bash
# Smoke test: 1 question
./benchmark/run.sh 1

# Standard benchmark: 5 questions
./benchmark/run.sh 5

# Full suite: 10+ questions
./benchmark/run.sh 10
```

**Arguments:** `./benchmark/run.sh [LIMIT] [WAIT_FOR_SEARCH_SECS] [SHOW_PASSED]`

---

## 🔍 Further Reading

For more detailed information, see the following guides:
- [**Benchmarking Guide**](./BENCHMARKING.md): Detailed step-by-step for humans and agents.
- [**Integration Details**](./MEMORYBENCH_INTEGRATION.md): Deep dive into the architecture and data flow.
- [**Benchmark Comparison**](./BENCHMARK_COMPARISON.md): Strategies for comparing Memsy with other providers.

---

## 🔧 Troubleshooting

### `bun: command not found`
```bash
curl -fsSL https://bun.sh/install | bash
export PATH="$HOME/.bun/bin:$PATH"
```

### Memsy API not responding (port 8003)
Verify the process is running:
```bash
lsof -i :8003
```

### Database or Redis connection errors
Check container health:
```bash
docker-compose ps
docker-compose logs postgres
```