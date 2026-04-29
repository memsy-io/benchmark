# Memsy LoCoMo Benchmark Results

Summary of full-suite (1540 questions) LoCoMo runs preserved under `history/`. Judge and answerer both `gpt-4.1-mini`. `k` differs per run (see table).

## Headline numbers

| Run | Date (UTC) | k | Accuracy | Correct | Hit@10 | MRR | nDCG | MemScore | Avg ctx tok |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| [memsy-locomo-20260408-cdyi](history/memsy-locomo-20260408-cdyi/report.json) | 2026-04-08 21:58 | 10 | **88.90%** | 1369 / 1540 | 95.97% | 0.9089 | 0.9032 | 89% / 1031ms / 3579tok | 3579 |
| [memsy-locomo-20260428-mzao](history/memsy-locomo-20260428-mzao/report.json) | 2026-04-28 18:12 | 10 | 87.21% | 1343 / 1540 | 94.94% | 0.8941 | 0.8913 | 87% / 936ms / 966tok | 966 |
| [memsy-locomo-20260428-2n68](history/memsy-locomo-20260428-2n68/report.json) | 2026-04-28 23:23 | 20 | **88.83%** | 1368 / 1540 | — | — | — | 89% / 1221ms / 1597tok | 1597 |

`2n68` reused `mzao`'s ingestion (`dataSourceRunId: memsy-locomo-20260428-mzao`); only retrieval, answering, and evaluation were re-run. Hit@10 / MRR / nDCG are omitted for `2n68` because the run uses k=20, so its retrieval metrics aren't comparable to the k=10 runs above.

## Accuracy by question type

| Run | multi-hop (321) | temporal (96) | single-hop (282) | world-knowledge (841) |
| --- | ---: | ---: | ---: | ---: |
| cdyi (k=10) | 85.05% (273) | 73.96% (71) | 86.52% (244) | 92.87% (781) |
| mzao (k=10) | 83.18% (267) | 72.92% (70) | 87.59% (247) | 90.25% (759) |
| 2n68 (k=20) | 81.62% (262) | **79.17% (76)** | **89.72% (253)** | 92.39% (777) |

## Retrieval quality by question type (k=10 runs only)

| Run | multi-hop | temporal | single-hop | world-knowledge |
| --- | ---: | ---: | ---: | ---: |
| cdyi | 95.95% | 84.38% | 97.52% | 96.79% |
| mzao | 95.02% | 82.29% | 98.94% | 95.01% |

## Latency (ms, median / p95)

| Run | search | answer | evaluate | total |
| --- | --- | --- | --- | --- |
| cdyi | 932 / 1684 | 7211 / 9912 | 7751 / 11000 | 16603 / 40171 |
| mzao | 771 / 2060 | 4683 / 9107 | 4400 / 7182 | 10694 / 31023 |
| 2n68 | 1038 / 1816 | 6856 / 10381 | 7395 / 9767 | 16004 / 35931 |

## Token usage

| Run | total tokens | avg / question | base prompt avg | context avg |
| --- | ---: | ---: | ---: | ---: |
| cdyi | 6,684,754 | 4341 | 762 | 3579 |
| mzao | 2,793,506 | 1814 | 848 | 966 |
| 2n68 | 3,980,717 | 2585 | 988 | 1597 |

## Observations

- **Best accuracy:** `cdyi` (k=10) at 88.90% (1369/1540). `2n68` (k=20) is within one question (1368) at ~55% the context-token cost of `cdyi`.
- **Temporal swing:** `2n68` jumped temporal accuracy to 79.17% (+6.25 pts vs `mzao`, same ingest) — the largest per-category move across all three runs. Likely driven by the wider candidate pool surfacing date-bearing memories that fall outside the top 10.
- **mzao → 2n68 (same ingest, k=10 → k=20 + prompt):** +1.62 pts overall (1343 → 1368). Multi-hop dropped (-1.56) while temporal (+6.25) and single-hop (+2.13) gained. Net positive on the same memory store.
- **Retrieval ceiling on k=10 runs:** Hit@10 sits at 94.94–95.97%; failure modes concentrate in answer-generation, not retrieval.
- **Reference (mem0, k=50):** 82.7% overall, 86.3% temporal. Memsy beats mem0 on overall accuracy in all three runs while operating at k≤20.

## How to add a run

1. Place the run directory under `history/<runId>/` containing `report.json`.
2. Append a row to the headline + per-category tables above and record the run's `k` value.
3. Only include Hit@10 / MRR / nDCG when the run uses the same `k` as the rest of that table; otherwise leave the cells blank with a footnote.
4. Note any methodology changes (multiplier, prompt iteration, ingestion source) in the Observations section.
