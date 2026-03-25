# Benchmarking Memsy with MemoryBench

This guide explains how to run the [MemoryBench](https://github.com/supermemoryai/memorybench) suite against your local Memsy instance.

---

## Quick Start (TL;DR)

```bash
# 1. Start infrastructure
docker-compose up -d

# 2. Create .env file (if not exists)
cat > .env << EOF
DATABASE_URL=postgresql://user:password@localhost:5432/memory_db
OPENAI_API_KEY=your-openai-key-here
MEMSY_API_URL=http://localhost:8003
EOF

# 3. Setup MemoryBench (one-time)
./benchmark/setup.sh

# 4. Start Memsy API (Terminal 1)
source .env && .venv/bin/uvicorn memsy.http.api:app --port 8003

# 5. Run benchmark (Terminal 2)
./benchmark/run.sh 5
```

---

## 🤖 For AI Agents (Cursor/Windsurf/Copilot)

**Developer:** Copy and paste the following block into your Agent's chat window:

```text
@Agent I need to run benchmarks for Memsy. Please follow these steps:

1. **Check Prerequisites**:
   - Verify docker is running: `docker ps`
   - Check if postgres/redis containers are up: `docker-compose ps`
   - If not running: `docker-compose up -d`

2. **Setup Environment**:
   - Ensure `.env` file exists with DATABASE_URL and OPENAI_API_KEY
   - Run setup script: `./benchmark/setup.sh`
   
3. **Start Memsy API** (if not running):
   - In a new terminal: `source .env && .venv/bin/uvicorn memsy.http.api:app --port 8003`
   - Verify it's running: `curl http://localhost:8003/health`

4. **Run Benchmarks**:
   - Smoke test: `./benchmark/run.sh 1`
   - Full test: `./benchmark/run.sh 5`

5. **Report**: Summarize the results (Hit@K, MRR, Latency) from the output.
```

---

## 👤 For Humans - Step by Step

### Step 1: Prerequisites

Install these tools first:

| Tool | Version | Check Command | Install |
|------|---------|---------------|---------|
| **Docker** | Any | `docker --version` | [docker.com](https://docker.com) |
| **Bun** | v1.0+ | `bun --version` | `curl -fsSL https://bun.sh/install \| bash` |
| **Python** | 3.12+ | `python3 --version` | [python.org](https://python.org) |

### Step 2: Start Infrastructure

Memsy needs PostgreSQL (with pgvector) and Redis:

```bash
cd /path/to/memsy
docker-compose up -d
```

Verify containers are healthy:
```bash
docker-compose ps
# Should show postgres and redis as "healthy"
```

### Step 3: Create Environment File

Create a `.env` file in the memsy root directory:

```bash
cat > .env << 'EOF'
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/memory_db
OPENAI_API_KEY=sk-your-key-here

# Memsy API URL (for benchmark runner)
MEMSY_API_URL=http://localhost:8003

# Optional: Benchmark-optimized settings
MEMSY_SKIP_PROMOTION=true
MEMSY_EXTRACTION_WORKERS=16
MEMSY_PARALLEL_EXTRACTION=true
MEMSY_DOMAIN=GENERAL
EOF
```

> **Note:** Replace `sk-your-key-here` with your actual OpenAI API key.

### Step 4: Install Python Dependencies

```bash
# Option 1: Using uv (recommended)
uv sync

# Option 2: Using pip
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

> **Note:** The project uses `hatchling` as its build backend (configured in `pyproject.toml`). The `memorybench` and `benchmark` directories are excluded from the wheel build via `[tool.hatch.build.targets.wheel]`.

### Step 5: Setup MemoryBench

Run the setup script to clone and configure MemoryBench:

```bash
./benchmark/setup.sh
```

This script:
1. Clones the [memorybench](https://github.com/supermemoryai/memorybench) repo
2. Copies the Memsy adapter (`benchmark/adapter/`) into it
3. Patches the provider registration
4. Installs npm dependencies via bun

### Step 6: Start Memsy API

In a **separate terminal**:

```bash
cd /path/to/memsy
source .env
.venv/bin/uvicorn memsy.http.api:app --host 0.0.0.0 --port 8003
```

Verify it's running:
```bash
curl http://localhost:8003/health
# Should return: {"status":"ok","version":"2.0-sync"}
```

### Step 7: Run Benchmarks

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

# Basic run
bun run src/index.ts run --provider memsy --benchmark locomo --limit 5

# With judge model
bun run src/index.ts run -p memsy -b locomo -j gpt-4o -l 5

# Compare providers
bun run src/index.ts compare -p memsy,supermemory -b locomo -s 5
```

---

## Configuration Options

### Memsy Performance Tuning

Set these in your `.env` before starting the API:

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMSY_NUM_WORKERS` | `4` | Worker pool threads |
| `MEMSY_EXTRACTION_WORKERS` | `8` | Per-job extraction threads |
| `MEMSY_PARALLEL_EXTRACTION` | `true` | Enable parallel LLM calls |
| `MEMSY_SKIP_PROMOTION` | `false` | Skip episodic→semantic promotion |
| `MEMSY_DOMAIN` | `ENGINEERING` | Domain: ENGINEERING, GENERAL, MARKETING |

**For benchmarks**, use:
```bash
MEMSY_SKIP_PROMOTION=true
MEMSY_EXTRACTION_WORKERS=32
MEMSY_DOMAIN=GENERAL
```

### MemoryBench Options

| Flag | Description |
|------|-------------|
| `-p, --provider` | Provider name (memsy, supermemory, mem0, zep) |
| `-b, --benchmark` | Dataset (locomo, longmemeval, convomem) |
| `-l, --limit` | Limit number of questions |
| `-j, --judge` | Judge model (gpt-4o, claude-3, etc.) |
| `--force` | Restart from scratch (ignore checkpoint) |

---

## Troubleshooting

### "Connection Refused" on port 8003

**Cause:** Memsy API is not running.

**Fix:**
```bash
# Check if process is running
lsof -i :8003

# Start it
source .env && .venv/bin/uvicorn memsy.http.api:app --port 8003
```

### "Multiple top-level packages discovered"

**Cause:** Build tool finds both `memsy/` and `memorybench/` directories.

**Fix:** This project uses `hatchling` (not setuptools). Ensure `pyproject.toml` has:
```toml
[tool.hatch.build.targets.wheel]
packages = ["memsy"]
exclude = ["memorybench*", "benchmark*", "tests*"]
```

### "Missing OPENAI_API_KEY"

**Fix:** Ensure `.env` has your key and it's sourced:
```bash
source .env
echo $OPENAI_API_KEY  # Should show your key
```

### "bun: command not found"

**Fix:** Install bun:
```bash
curl -fsSL https://bun.sh/install | bash
# Restart terminal or run:
export PATH="$HOME/.bun/bin:$PATH"
```

### "Database connection failed"

**Fix:** Check postgres is running:
```bash
docker-compose ps
docker-compose logs postgres
```

### Reset Everything

If things are broken, clean slate:
```bash
# Stop and remove containers
docker-compose down -v

# Remove memorybench clone
rm -rf memorybench

# Restart
docker-compose up -d
./benchmark/setup.sh
```

---

## Directory Structure After Setup

```
memsy/
├── .env                      # Your environment variables
├── .venv/                    # Python virtual environment
├── benchmark/
│   ├── adapter/              # Memsy provider source
│   │   ├── index.ts
│   │   └── prompts.ts
│   ├── BENCHMARKING.md       # This file
│   ├── run.sh                # Benchmark runner with logging
│   └── setup.sh              # One-time setup script
├── memorybench/              # Cloned MemoryBench repo (gitignored)
│   └── src/providers/memsy/  # Injected adapter
├── memsy/                    # Memsy Python package
└── docker-compose.yml        # Postgres + Redis
```
