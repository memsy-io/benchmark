# Memsy LoCoMo Benchmark Results

Summary of full-suite (1540 questions) LoCoMo runs preserved under `history/`. Judge and answerer both `gpt-4.1-mini`. `k` differs per run (see table).

## Headline numbers

| Run | Date (UTC) | k | Accuracy | Correct | Hit@10 | MRR | nDCG | MemScore | Avg ctx tok |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| [memsy-locomo-20260408-cdyi](history/memsy-locomo-20260408-cdyi/report.json) | 2026-04-08 21:58 | 10 | **88.90%** | 1369 / 1540 | 95.97% | 0.9089 | 0.9032 | 89% / 1031ms / 3579tok | 3579 |
| [memsy-locomo-20260428-mzao](history/memsy-locomo-20260428-mzao/report.json) | 2026-04-28 18:12 | 10 | 87.21% | 1343 / 1540 | 94.94% | 0.8941 | 0.8913 | 87% / 936ms / 966tok | 966 |
| [memsy-locomo-20260428-2n68](history/memsy-locomo-20260428-2n68/report.json) | 2026-04-28 23:23 | 20 | **88.83%** | 1368 / 1540 | — | — | — | 89% / 1221ms / 1597tok | 1597 |
| [memsy-locomo-20260505-1ksp](history/memsy-locomo-20260505-1ksp/report.json) | 2026-05-05 18:57 | 20 | 87.73% | 1351 / 1540 | — | — | — | 88% / 1269ms / 1764tok | 1764 |
| [memsy-locomo-20260505-rik3](history/memsy-locomo-20260505-rik3/report.json) | 2026-05-05 21:08 | 20 | 88.12% | 1357 / 1540 | — | — | — | 88% / 1269ms / 1736tok | 1736 |
| [memsy-locomo-20260626-ho8o](history/memsy-locomo-20260626-ho8o/report.json) | 2026-06-26 18:56 | 20 | 88.82% | 1367 / 1539 | — | — | — | 89% / 1690ms / 1176tok | 1176 |
| [memsy-locomo-20260627-9984](history/memsy-locomo-20260627-9984/report.json) | 2026-06-27 01:24 | 25 | **90.84%** | 1399 / 1540 | — | — | — | 91% / 1831ms / 2412tok | 2412 |
| [memsy-locomo-20260909-py2k](history/memsy-locomo-20260909-py2k/report.json) | 2026-09-09 18:25 | 10 | **90.19%** | 1389 / 1540 | 95.52% | 0.8937 | 0.8864 | 90% / 1867ms / 942tok | 942 |

`2n68` reused `mzao`'s ingestion (`dataSourceRunId: memsy-locomo-20260428-mzao`). `rik3` reused `1ksp`'s ingestion (`dataSourceRunId: memsy-locomo-20260505-1ksp`). `9984` reused `ho8o`'s ingestion (`dataSourceRunId: memsy-locomo-20260626-ho8o`). Hit@10 / MRR / nDCG are omitted for all k>10 runs; see the per-k retrieval tables below. `ho8o` ran over 1539 questions (one question skipped during ingest). `py2k` is a fresh ingest (`dataSourceRunId` is self).

> **Metric caveat:** in these reports `recallAtK` is byte-identical to `hitAtK` at every level (overall and per question type), so the "Recall@K" columns below are really hit-rate — the fraction of questions with *at least one* gold memory in the top k, not the fraction of gold memories retrieved. Read them as an upper bound on true recall.

## Accuracy by question type

| Run | multi-hop (321) | temporal (96) | single-hop (282) | world-knowledge (841) |
| --- | ---: | ---: | ---: | ---: |
| cdyi (k=10) | 85.05% (273) | 73.96% (71) | 86.52% (244) | 92.87% (781) |
| mzao (k=10) | 83.18% (267) | 72.92% (70) | 87.59% (247) | 90.25% (759) |
| 2n68 (k=20) | 81.62% (262) | **79.17% (76)** | **89.72% (253)** | 92.39% (777) |
| 1ksp (k=20) | 83.49% (268) | 73.96% (71) | 87.94% (248) | 90.84% (764) |
| rik3 (k=20) | 84.11% (270) | 76.04% (73) | 86.88% (245) | **91.44% (769)** |
| ho8o (k=20) | 89.38% (286) | 72.92% (70) | 88.30% (249) | 90.61% (762) |
| 9984 (k=25) | **90.34% (290)** | 75.00% (72) | **91.84% (259)** | **92.51% (778)** |
| py2k (k=10) | 88.47% (284) | 76.04% (73) | 90.07% (254) | 92.51% (778) |

## Retrieval quality by question type (k=10 runs — Recall@10 / Hit@10)

| Run | multi-hop | temporal | single-hop | world-knowledge |
| --- | ---: | ---: | ---: | ---: |
| cdyi | 95.95% | 84.38% | 97.52% | 96.79% |
| mzao | 95.02% | 82.29% | 98.94% | 95.01% |
| py2k | 95.33% | 80.21% | 98.23% | 96.43% |

### py2k (full detail)

| Metric | multi-hop | temporal | single-hop | world-knowledge | overall |
| --- | ---: | ---: | ---: | ---: | ---: |
| Recall@10 | 95.33% | 80.21% | 98.23% | 96.43% | 95.52% |
| Precision@10 | 24.36% | 40.97% | 51.03% | 30.42% | 33.59% |
| F1@10 | 35.85% | 48.64% | 63.07% | 42.53% | 45.28% |
| MRR | 0.901 | 0.726 | 0.916 | 0.902 | 0.894 |
| NDCG | 0.894 | 0.730 | 0.907 | 0.895 | 0.886 |

`cdyi` and `mzao` predate per-type Precision/F1/MRR/NDCG reporting, hence the single-row entries above.

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

### ho8o

| Metric | multi-hop | temporal | single-hop | world-knowledge | overall |
| --- | ---: | ---: | ---: | ---: | ---: |
| Recall@20 | 95.94% | 87.50% | 97.16% | 94.89% | 95.06% |
| Precision@20 | 15.41% | 29.96% | 28.49% | 17.04% | 19.61% |
| F1@20 | 24.55% | 38.87% | 40.26% | 26.49% | 29.38% |
| MRR | 0.904 | 0.795 | 0.912 | 0.883 | 0.887 |
| NDCG | 0.893 | 0.795 | 0.886 | 0.875 | 0.876 |

## Retrieval quality — k=25 runs

### 9984

| Metric | multi-hop | temporal | single-hop | world-knowledge | overall |
| --- | ---: | ---: | ---: | ---: | ---: |
| Recall@25 | 96.26% | 87.50% | 98.58% | 96.67% | 96.36% |
| Precision@25 | 11.91% | 27.68% | 25.98% | 13.73% | 16.47% |
| F1@25 | 19.76% | 36.34% | 37.38% | 22.08% | 25.29% |
| MRR | 0.907 | 0.762 | 0.926 | 0.896 | 0.896 |
| NDCG | 0.895 | 0.753 | 0.895 | 0.887 | 0.882 |

## Latency (ms, median / p95)

| Run | search | answer | evaluate | total |
| --- | --- | --- | --- | --- |
| cdyi | 932 / 1684 | 7211 / 9912 | 7751 / 11000 | 16603 / 40171 |
| mzao | 771 / 2060 | 4683 / 9107 | 4400 / 7182 | 10694 / 31023 |
| 2n68 | 1038 / 1816 | 6856 / 10381 | 7395 / 9767 | 16004 / 35931 |
| 1ksp | 1144 / 1964 | 7412 / 13144 | 7408 / 14438 | 17061 / 43070 |
| rik3 | 1144 / 1964 | 7308 / 10981 | 7418 / 11822 | 16677 / 42559 |
| ho8o | 1388 / 3439 | 9548 / 16796 | 12439 / 18756 | 25392 / 54223 |
| 9984 | 1631 / 3429 | 12715 / 17473 | 15438 / 25948 | 31526 / 60146 |
| py2k | 1836 / 2466 | 4389 / 7921 | 3549 / 6511 | 10254 / 15603 |

## Token usage

| Run | total tokens | avg / question | base prompt avg | context avg |
| --- | ---: | ---: | ---: | ---: |
| cdyi | 6,684,754 | 4341 | 762 | 3579 |
| mzao | 2,793,506 | 1814 | 848 | 966 |
| 2n68 | 3,980,717 | 2585 | 988 | 1597 |
| 1ksp | — | — | — | 1764 |
| rik3 | — | — | — | 1736 |
| ho8o | 4,717,570 | 3065 | 1890 | 1176 |
| 9984 | 6,625,280 | 4302 | 1890 | 2412 |
| py2k | 3,930,316 | 2552 | 1610 | 942 |

## Observations

- **Best accuracy:** `9984` (k=25) at 90.84% (1399/1540); `py2k` (k=10) is second at 90.19% (1389/1540) for 39% of the context tokens. Among k=10 runs, `py2k` leads `cdyi` (88.90%) by +1.29 pts.
- **Temporal swing:** `2n68` jumped temporal accuracy to 79.17% (+6.25 pts vs `mzao`, same ingest) — the largest per-category move across all three runs. Likely driven by the wider candidate pool surfacing date-bearing memories that fall outside the top 10.
- **mzao → 2n68 (same ingest, k=10 → k=20):** +1.62 pts overall (1343 → 1368). Multi-hop dropped (−1.56) while temporal (+6.25) and single-hop (+2.13) gained. Net positive on the same memory store.
- **Retrieval ceiling on k=10 runs:** Hit@10 sits at 94.94–95.97%; failure modes concentrate in answer-generation, not retrieval.
- **1ksp:** Fresh ingest run at k=20 (`dataSourceRunId` is self). Retrieval Recall@20 = 96.56%, MRR = 0.907, NDCG = 0.893. Serves as the ingest source for `rik3`.
- **rik3:** Reuses `1ksp` ingest; only retrieval, answering, and evaluation re-run. Retrieval Recall@20 = 96.43%, MRR = 0.909, NDCG = 0.894. Accuracy +0.39 pts vs `1ksp` on the same memory store (1351 → 1357 correct).
- **Reference (mem0, k=50):** 82.7% overall, 86.3% temporal. Memsy beats mem0 on overall accuracy in all runs while operating at k≤25.
- **ho8o (k=20, fresh ingest):** 88.82% (1367/1539) — consistent with prior k=20 runs. Serves as the ingest source for `9984`. One question was skipped during ingest (1539 vs 1540 total).
- **9984 (k=25, reuses ho8o ingest):** **90.84% (1399/1540) — new all-time best**, up +1.94 pts from cdyi (previous best at 88.90%). All gain comes from widening k from 20 to 25 on the same memory store. Multi-hop improved most (+0.96 vs ho8o), single-hop gained +3.54 pts, and world-knowledge jumped +1.90 pts. Temporal remains the ceiling — only +2.08 pts (72.92% → 75.00%).
- **k=20 → k=25 (same ingest, ho8o → 9984):** +2.02 pts overall. Retrieval Recall@k rose from 95.06% to 96.36%, and MRR improved from 0.887 to 0.896 — the wider candidate pool delivers meaningfully more accurate answers across all question types.
- **py2k (k=10, fresh ingest): 90.19% (1389/1540) — best k=10 run to date**, +1.29 pts over `cdyi`, and within 0.65 pts of the all-time best `9984` (k=25) while using 942 context tokens vs 2412 and a median total latency of 10.3s vs 31.5s. Retrieval is slightly *worse* than `cdyi` (Hit@10 95.52% vs 95.97%, MRR 0.894 vs 0.909), so the gain is answer-side, not retrieval-side.
- **Efficiency frontier:** `py2k` breaks the "wider k buys accuracy" pattern — 90.19% at 942 ctx tok beats 88.83% at 1597 tok (`2n68`, k=20) and 87.73% at 1764 tok (`1ksp`, k=20). Best accuracy-per-context-token of any run here.
- **Temporal on py2k:** best temporal of any k=10 run (76.04%) *despite* the worst temporal Hit@10 (80.21% vs 84.38% for `cdyi`) and the worst temporal MRR (0.726). Temporal remains the weakest category in every run regardless of k.

## How to add a run

1. Place the run directory under `history/<runId>/` containing `report.json`.
2. Append a row to the headline + per-category tables above and record the run's `k` value.
3. Only include Hit@10 / MRR / nDCG when the run uses the same `k` as the rest of that table; otherwise leave the cells blank with a footnote.
4. Note any methodology changes (multiplier, prompt iteration, ingestion source) in the Observations section.
