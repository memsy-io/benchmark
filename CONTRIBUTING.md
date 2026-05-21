# Contributing

Thanks for your interest in improving the Memsy benchmark harness.

## What lives here

This repo ships only the Memsy-specific layer on top of the upstream
[MemoryBench](https://github.com/supermemoryai/memorybench) framework:

| Path | What it is |
|------|-----------|
| `adapter/` | Memsy provider implementation for MemoryBench |
| `patches/` | Patches applied to MemoryBench at setup time |
| `results/` | Saved benchmark runs and history |
| `setup.sh` | One-time setup: clones MemoryBench, injects adapter, applies patches |
| `run.sh` | Benchmark runner with result logging |
| `update_patches.sh` | Regenerates `patches/` from a working `memorybench/` checkout |

Improvements to MemoryBench itself belong upstream at
[supermemoryai/memorybench](https://github.com/supermemoryai/memorybench).

## Local setup

```bash
cp .env.example .env       # fill in MEMSY_API_KEY and OPENAI_API_KEY
./setup.sh                 # clones memorybench, injects adapter, installs deps
./run.sh 1                 # smoke test (1 question)
./run.sh 5                 # standard run (5 questions)
```

See [BENCHMARKING.md](BENCHMARKING.md) for the full guide.

## Adding or updating a patch

1. Make your changes inside the `memorybench/` working directory.
2. Run `./update_patches.sh` to regenerate `patches/` from the diff.
3. Verify `./setup.sh` applies cleanly on a fresh clone: `rm -rf memorybench && ./setup.sh`.
4. Open a PR with the updated `patches/` files and a description of what changed and why.

## Submitting changes

- Open a PR against `main`.
- Scope: Memsy adapter improvements (`adapter/`), patch updates, results, or harness scripts.
- Include a brief description of the change and, for adapter changes, a before/after benchmark run if feasible.
- All contributions are licensed under MIT (see `LICENSE`).
