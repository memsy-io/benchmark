# Benchmarking Memsy with MemoryBench

This guide explains how to run the [MemoryBench](https://github.com/supermemoryai/memorybench) suite against the hosted Memsy API at `https://api.memsy.io/v1`. No local server setup required.

---

## Quick Start (TL;DR)

```bash
# 1. Create .env file
cat > .env << 'EOF'
MEMSY_API_URL=https://api.memsy.io/v1
MEMSY_API_KEY=your-memsy-api-key-here
OPENAI_API_KEY=sk-your-openai-key-here
EOF

# 2. Setup MemoryBench (one-time)
./benchmark/setup.sh

# 3. Run benchmark
./benchmark/run.sh 5
```

Get your Memsy API key at **https://app.memsy.io → Settings → API Keys**.

---

## 🤖 For AI Agents (Cursor/Windsurf/Copilot)

**Developer:** Copy and paste the following block into your Agent's chat window:

```text
@Agent I need to run benchmarks for Memsy. Please follow these steps:

1. **Setup Environment**:
   - Ensure `.env` file exists with MEMSY_API_KEY, MEMSY_API_URL, and OPENAI_API_KEY
   - Run setup script: `./benchmark/setup.sh`

2. **Run Benchmarks**:
   - Smoke test: `./benchmark/run.sh 1`
   - Standard test: `./benchmark/run.sh 5`

3. **Report**: Summarize the results (Hit@K, MRR, Latency) from the output.
```

---

## 👤 For Humans - Step by Step

### Step 1: Prerequisites

| Requirement | Check Command | Where to get it |
|-------------|---------------|-----------------|
| **Bun** v1.0+ | `bun --version` | `curl -fsSL https://bun.sh/install \| bash` |
| **Memsy API key** | — | [app.memsy.io](https://app.memsy.io) → Settings → API Keys |
| **OpenAI API key** | — | [platform.openai.com](https://platform.openai.com) |

### Step 2: Create Environment File

Create a `.env` file in the benchmark root directory:

```bash
cat > .env << 'EOF'
# Memsy hosted API
MEMSY_API_URL=https://api.memsy.io/v1
MEMSY_API_KEY=your-memsy-api-key-here

# Required for the judge and answering models
OPENAI_API_KEY=sk-your-openai-key-here
EOF
```

> **Note:** Replace the placeholder values with your actual API keys.

### Step 3: Setup MemoryBench

Run the setup script to clone and configure MemoryBench:

```bash
./benchmark/setup.sh
```

This script:
1. Clones the [memorybench](https://github.com/supermemoryai/memorybench) repo
2. Copies the Memsy adapter (`benchmark/adapter/`) into it
3. Patches the provider registration and config to wire up your API key
4. Installs npm dependencies via bun

### Step 4: Run Benchmarks

Use the wrapper script to run benchmarks and automatically log results:

```bash
# Smoke test (1 question)
./benchmark/run.sh 1

# Standard benchmark (5 questions)
./benchmark/run.sh 5

# Full benchmark (10+ questions)
./benchmark/run.sh 10

# With custom wait time for search index (20 seconds)
./benchmark/run.sh 5 20

# Show passed scenarios in addition to failures
./benchmark/run.sh 5 10 true
```

**Arguments:**
- `LIMIT`: Number of questions to run (default: 5)
- `WAIT_FOR_SEARCH`: Seconds to wait for search index (default: 10)
- `SHOW_PASSED`: Show passed scenarios (true/false, default: false)

Results are logged to `BENCHMARK_HISTORY.md` and full output to `benchmark_logs/`.

---

## Manual Benchmark Commands

If you prefer not to use the wrapper script:

```bash
cd memorybench

# Basic run (ensure env vars are set)
MEMSY_API_URL=https://api.memsy.io/v1 MEMSY_API_KEY=your-key \
  bun run src/index.ts run --provider memsy --benchmark locomo --limit 5

# With judge model
MEMSY_API_URL=https://api.memsy.io/v1 MEMSY_API_KEY=your-key \
  bun run src/index.ts run -p memsy -b locomo -j gpt-4o -l 5

# Compare providers
MEMSY_API_URL=https://api.memsy.io/v1 MEMSY_API_KEY=your-key \
  bun run src/index.ts compare -p memsy,supermemory -b locomo -s 5
```

---

## Configuration Options

### MemoryBench Options

| Flag | Description |
|------|-------------|
| `-p, --provider` | Provider name (memsy, supermemory, mem0, zep) |
| `-b, --benchmark` | Dataset (locomo, longmemeval, convomem) |
| `-l, --limit` | Limit number of questions |
| `-j, --judge` | Judge model (gpt-4o, gpt-4.1-mini, etc.) |
| `--force` | Restart from scratch (ignore checkpoint) |
| `--wait-for-search` | Seconds to wait for indexing before querying |
| `--limit-round-robin` | Exactly N questions, rotating across categories |

---

## Troubleshooting

### "MEMSY_API_KEY is not set"

**Fix:** Add your API key to `.env` and source it, or export it directly:

```bash
export MEMSY_API_KEY=your-key-here
```

Get your key at **https://app.memsy.io → Settings → API Keys**.

### "Health check failed: 401"

**Cause:** Invalid or expired API key.

**Fix:** Rotate your key at **https://app.memsy.io → Settings → API Keys** and update `.env`.

### "Health check failed: 429" / Usage limit errors

**Cause:** You've hit a rate or usage limit on your plan.

**Fix:** Wait for the rate limit window to reset, or upgrade your plan at **https://app.memsy.io**.

### "bun: command not found"

**Fix:** Install bun:

```bash
curl -fsSL https://bun.sh/install | bash
# Restart terminal or run:
export PATH="$HOME/.bun/bin:$PATH"
```

### "Failed to connect to Memsy API"

**Cause:** Network issue or wrong `MEMSY_API_URL`.

**Fix:** Verify your URL:

```bash
curl -H "Authorization: Bearer $MEMSY_API_KEY" https://api.memsy.io/v1/health
# Should return: {"status":"ok","version":"..."}
```

### Reset MemoryBench

If the MemoryBench clone gets into a bad state:

```bash
rm -rf memorybench
./benchmark/setup.sh
```

---

## Directory Structure After Setup

```
benchmark/
├── adapter/              # Memsy provider source
│   ├── index.ts
│   └── prompts.ts
├── BENCHMARKING.md       # This file
├── run.sh                # Benchmark runner with logging
├── setup.sh              # One-time setup script
├── patches/              # Custom patches for MemoryBench
└── results/              # Saved benchmark results

memorybench/              # Cloned MemoryBench repo (gitignored)
└── src/providers/memsy/  # Injected adapter

.env                      # Your API keys (never commit this)
```
