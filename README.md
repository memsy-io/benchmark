# Memsy Benchmark

Memsy adapter and runner for the [MemoryBench](https://github.com/supermemoryai/memorybench) evaluation suite.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Results

Evaluated on the full **LoCoMo** dataset (1,540 questions). Judge and answerer: `gpt-4.1-mini`.

| Run | k | Accuracy | Hit@10 | MRR |
|-----|--:|--------:|-------:|----:|
| [cdyi](results/history/memsy-locomo-20260408-cdyi/report.json) | 10 | 88.90% | 95.97% | 0.9089 |
| [2n68](results/history/memsy-locomo-20260428-2n68/report.json) | 20 | 88.83% | — | — |
| [rik3](results/history/memsy-locomo-20260505-rik3/report.json) | 20 | 88.12% | — | — |
| [ho8o](results/history/memsy-locomo-20260626-ho8o/report.json) | 20 | 88.82% | — | — |
| [9984](results/history/memsy-locomo-20260627-9984/report.json) | 25 | **90.84%** | — | — |

Full breakdown by question type, retrieval quality, and latency: [results/BENCHMARK_RESULTS.md](results/BENCHMARK_RESULTS.md).

**Reference:** mem0 scores 82.7% at k=50 on the same dataset. Memsy beats that in all runs at k≤25.

## Quick start

```bash
# 1. Configure env
cp .env.example .env
# Fill in MEMSY_API_KEY and OPENAI_API_KEY in .env

# 2. One-time setup (clones MemoryBench, injects adapter, installs deps)
./setup.sh

# 3. Run benchmark
./run.sh 5        # 5 questions (standard)
./run.sh 1        # 1 question  (smoke test)
```

Get your Memsy API key at **[app.memsy.io](https://app.memsy.io) → Settings → API Keys**.

For the full guide — configuration options, troubleshooting, manual commands — see [BENCHMARKING.md](BENCHMARKING.md).

## Repo layout

```
benchmark/
├── adapter/          # Memsy provider for MemoryBench (index.ts, prompts.ts)
├── patches/          # Patches applied to MemoryBench at setup time
├── results/          # Saved benchmark runs and history
├── setup.sh          # One-time setup script
├── run.sh            # Benchmark runner with result logging
├── update_patches.sh # Regenerates patches/ from a working memorybench/ checkout
└── BENCHMARKING.md   # Full how-to guide

memorybench/          # Cloned by setup.sh (gitignored — not committed)
```

## How it works

`setup.sh` clones [supermemoryai/memorybench](https://github.com/supermemoryai/memorybench), copies the Memsy adapter from `adapter/` into it, applies the patches from `patches/`, and installs npm dependencies. `run.sh` then drives the benchmark and appends results to `BENCHMARK_HISTORY.md`.

## License & acknowledgements

This project is licensed under the [MIT License](LICENSE).

It depends on and patches [MemoryBench](https://github.com/supermemoryai/memorybench) by [supermemory](https://supermemory.ai) (MIT © 2025 supermemory). See [NOTICE](NOTICE).

---

[memsy.io](https://memsy.io) · [Docs](https://docs.memsy.io) · [Get started](https://app.memsy.io)
