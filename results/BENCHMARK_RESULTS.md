# Memsy LoCoMo Benchmark Results

Summary of full-suite (1540 questions) LoCoMo runs preserved under `history/`. Judge and answerer both `gpt-4.1-mini`. `k` differs per run (see table).

## Headline numbers

| Run | Date (UTC) | k | Accuracy | Correct | Hit@10 | MRR | nDCG | MemScore | Avg ctx tok |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| [memsy-locomo-20260408-cdyi](history/memsy-locomo-20260408-cdyi/report.json) | 2026-04-08 21:58 | 10 | **88.90%** | 1369 / 1540 | 95.97% | 0.9089 | 0.9032 | 89% / 1031ms / 3579tok | 3579 |
| [memsy-locomo-20260428-mzao](history/memsy-locomo-20260428-mzao/report.json) | 2026-04-28 18:12 | 10 | 87.21% | 1343 / 1540 | 94.94% | 0.8941 | 0.8913 | 87% / 936ms / 966tok | 966 |
| [memsy-locomo-20260428-2n68](history/memsy-locomo-20260428-2n68/report.json) | 2026-04-28 23:23 | 20 | **88.83%** | 1368 / 1540 | — | — | — | 89% / 1221ms / 1597tok | 1597 |
| [memsy-locomo-20260505-1ksp](history/memsy-locomo-20260505-1ksp/report.json) | 2026-05-05 18:57 | 20 | 87.73% | 1351 / 1540 | — | — | — | 88% / 1269ms / 1764tok | 1764 |
| [memsy-locomo-20260505-rik3](history/memsy-locomo-20260505-rik3/report.json) | 2026-05-05 21:08 | 20 | **88.12%** | 1357 / 1540 | — | — | — | 88% / 1269ms / 1736tok | 1736 |

`2n68` reused `mzao`'s ingestion (`dataSourceRunId: memsy-locomo-20260428-mzao`). `rik3` reused `1ksp`'s ingestion (`dataSourceRunId: memsy-locomo-20260505-1ksp`). Hit@10 / MRR / nDCG are omitted for all k=20 runs; see the k=20 retrieval table below.

## Accuracy by question type

| Run | multi-hop (321) | temporal (96) | single-hop (282) | world-knowledge (841) |
| --- | ---: | ---: | ---: | ---: |
| cdyi (k=10) | 85.05% (273) | 73.96% (71) | 86.52% (244) | 92.87% (781) |
| mzao (k=10) | 83.18% (267) | 72.92% (70) | 87.59% (247) | 90.25% (759) |
| 2n68 (k=20) | 81.62% (262) | **79.17% (76)** | **89.72% (253)** | 92.39% (777) |
| 1ksp (k=20) | 83.49% (268) | 73.96% (71) | 87.94% (248) | 90.84% (764) |
| rik3 (k=20) | 84.11% (270) | 76.04% (73) | 86.88% (245) | **91.44% (769)** |

## Retrieval quality by question type (k=10 runs — Recall@10 / Hit@10)

| Run | multi-hop | temporal | single-hop | world-knowledge |
| --- | ---: | ---: | ---: | ---: |
| cdyi | 95.95% | 84.38% | 97.52% | 96.79% |
| mzao | 95.02% | 82.29% | 98.94% | 95.01% |

## Retrieval quality — k=20 runs

### 1ksp

| Metric | multi-hop | temporal | single-hop | world-knowledge | overall |
| --- | ---: | ---: | ---: | ---: | ---: |
| Recall@20 | 95.64% | 90.62% | 98.94% | 96.79% | 96.56% |
| Precision@20 | 15.44% | 35.68% | 45.48% | 22.35% | 25.98% |
| F1@20 | 24.45% | 44.56% | 58.00% | 33.40% | 36.74% |
| MRR | 0.913 | 0.805 | 0.946 | 0.904 | 0.907 |
| NDCG | 0.902 | 0.794 | 0.922 | 0.891 | 0.893 |

### rik3

| Metric | multi-hop | temporal | single-hop | world-knowledge | overall |
| --- | ---: | ---: | ---: | ---: | ---: |
| Recall@20 | 95.95% | 89.58% | 98.94% | 96.55% | 96.43% |
| Precision@20 | 15.62% | 35.83% | 47.23% | 22.51% | 26.43% |
| F1@20 | 24.66% | 44.22% | 59.49% | 33.48% | 37.08% |
| MRR | 0.914 | 0.785 | 0.947 | 0.908 | 0.909 |
| NDCG | 0.905 | 0.781 | 0.925 | 0.891 | 0.894 |

## Latency (ms, median / p95)

| Run | search | answer | evaluate | total |
| --- | --- | --- | --- | --- |
| cdyi | 932 / 1684 | 7211 / 9912 | 7751 / 11000 | 16603 / 40171 |
| mzao | 771 / 2060 | 4683 / 9107 | 4400 / 7182 | 10694 / 31023 |
| 2n68 | 1038 / 1816 | 6856 / 10381 | 7395 / 9767 | 16004 / 35931 |
| 1ksp | 1144 / 1964 | 7412 / 13144 | 7408 / 14438 | 17061 / 43070 |
| rik3 | 1144 / 1964 | 7308 / 10981 | 7418 / 11822 | 16677 / 42559 |

## Token usage

| Run | total tokens | avg / question | base prompt avg | context avg |
| --- | ---: | ---: | ---: | ---: |
| cdyi | 6,684,754 | 4341 | 762 | 3579 |
| mzao | 2,793,506 | 1814 | 848 | 966 |
| 2n68 | 3,980,717 | 2585 | 988 | 1597 |
| 1ksp | — | — | — | 1764 |
| rik3 | — | — | — | 1736 |

## Observations

- **Best accuracy:** `cdyi` (k=10) at 88.90% (1369/1540). `2n68` (k=20) is within one question (1368) at ~55% the context-token cost of `cdyi`.
- **Temporal swing:** `2n68` jumped temporal accuracy to 79.17% (+6.25 pts vs `mzao`, same ingest) — the largest per-category move across all three runs. Likely driven by the wider candidate pool surfacing date-bearing memories that fall outside the top 10.
- **mzao → 2n68 (same ingest, k=10 → k=20):** +1.62 pts overall (1343 → 1368). Multi-hop dropped (−1.56) while temporal (+6.25) and single-hop (+2.13) gained. Net positive on the same memory store.
- **Retrieval ceiling on k=10 runs:** Hit@10 sits at 94.94–95.97%; failure modes concentrate in answer-generation, not retrieval.
- **1ksp:** Fresh ingest run at k=20 (`dataSourceRunId` is self). Retrieval Recall@20 = 96.56%, MRR = 0.907, NDCG = 0.893. Serves as the ingest source for `rik3`.
- **rik3:** Reuses `1ksp` ingest; only retrieval, answering, and evaluation re-run. Retrieval Recall@20 = 96.43%, MRR = 0.909, NDCG = 0.894. Accuracy +0.39 pts vs `1ksp` on the same memory store (1351 → 1357 correct).
- **Reference (mem0, k=50):** 82.7% overall, 86.3% temporal. Memsy beats mem0 on overall accuracy in all four runs while operating at k≤20.

## How to add a run

1. Place the run directory under `history/<runId>/` containing `report.json`.
2. Append a row to the headline + per-category tables above and record the run's `k` value.
3. Only include Hit@10 / MRR / nDCG when the run uses the same `k` as the rest of that table; otherwise leave the cells blank with a footnote.
4. Note any methodology changes (multiplier, prompt iteration, ingestion source) in the Observations section.
