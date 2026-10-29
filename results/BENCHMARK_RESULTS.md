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
| [memsy-locomo-20261028-em0q](history/memsy-locomo-20261028-em0q/report.json) | 2026-10-28 06:49 | 10 | **91.10%** | 1403 / 1540 | 96.04% | 0.9028 | 0.8923 | 91% / 1478ms / 892tok | 892 |

`2n68` reused `mzao`'s ingestion (`dataSourceRunId: memsy-locomo-20260428-mzao`). `rik3` reused `1ksp`'s ingestion (`dataSourceRunId: memsy-locomo-20260505-1ksp`). `9984` reused `ho8o`'s ingestion (`dataSourceRunId: memsy-locomo-20260626-ho8o`). Hit@10 / MRR / nDCG are omitted for all k>10 runs; see the per-k retrieval tables below. `ho8o` ran over 1539 questions (one question skipped during ingest). `py2k` and `em0q` are fresh ingests (`dataSourceRunId` is self).

> **Metric caveat — `Recall@K` is hit-rate, and true recall is not recoverable.** `recallAtK` is byte-identical to `hitAtK` at every level in every report. The reason is that the harness never records a partial retrieval: across 6,160 questions (em0q, py2k, cdyi, 9984), `relevantRetrieved` is *always* either `0` or exactly `totalRelevant` — not once in between. With gold sets averaging 3.4 memories at k=10, all-or-nothing retrieval 100% of the time is not plausible real behavior, so `relevantRetrieved` is very likely derived from the hit flag rather than counted. Read the `Recall@K` columns as hit-rate; true recall cannot be computed from these artifacts, including from the raw counts.
>
> **`Precision@K` is at its structural ceiling, not underperforming.** Gold sets average 3.40 memories (min 1, max 10), so at k=10 the maximum achievable precision is ≈0.340. py2k reports 0.336. The low-looking value is a property of gold-set size versus k, not of retrieval quality. Note this ceiling is **run-specific**, because the gold-set size itself is not stable — see below.
>
> **Gold-set sizes are not stable across runs, so no retrieval metric is comparable between runs.** A gold set is a property of the LoCoMo dataset and should be identical for a given question in every run. It is not. Over the same 1540 `questionId`s:
>
> | Run | mean `totalRelevant` | `Precision@K` | ceiling (mean/k) |
> | --- | ---: | ---: | ---: |
> | em0q | 3.51 | 0.348 | 0.351 |
> | py2k | 3.40 | 0.336 | 0.340 |
> | mzao | 3.92 | 0.387 | 0.392 |
> | cdyi | 4.06 | 0.402 | 0.406 |
>
> **1345 of 1540 questions (87.3%) have a different gold-set size in different runs** — only 195 agree across all three. For example `conv-26-q1` is 1 in py2k, 4 in cdyi, 3 in mzao. That the gold set moves per run means it is being derived from what the system ingested or returned rather than from fixed annotations — the same mechanism as `relevantRetrieved` above, one level up.
>
> Consequences: **`Precision@K`, `Recall@K`, `F1@K` and `nDCG` are not comparable across runs**, and each run's precision tracks its own gold-set size almost exactly (see the ceiling column), so most of any cross-run precision gap is denominator, not retrieval quality. **Accuracy is unaffected** — it is judge-scored per question and independent of gold sets — and so is every McNemar result below, since those pair on `score` only.

## Accuracy by question type

| Run | multi-hop (321) | temporal (96) | single-hop (282) | world-knowledge (841) |
| --- | ---: | ---: | ---: | ---: |
| cdyi (k=10) | 85.05% (273) | 73.96% (71) | 86.52% (244) | 92.87% (781) |
| mzao (k=10) | 83.18% (267) | 72.92% (70) | 87.59% (247) | 90.25% (759) |
| py2k (k=10) | 88.47% (284) | 76.04% (73) | 90.07% (254) | 92.51% (778) |
| em0q (k=10) | 89.72% (288) | 77.08% (74) | 90.43% (255) | **93.46% (786)** |
| 2n68 (k=20) | 81.62% (262) | **79.17% (76)** | **89.72% (253)** | 92.39% (777) |
| 1ksp (k=20) | 83.49% (268) | 73.96% (71) | 87.94% (248) | 90.84% (764) |
| rik3 (k=20) | 84.11% (270) | 76.04% (73) | 86.88% (245) | **91.44% (769)** |
| ho8o (k=20) | 89.38% (286) | 72.92% (70) | 88.30% (249) | 90.61% (762) |
| 9984 (k=25) | **90.34% (290)** | 75.00% (72) | **91.84% (259)** | **92.51% (778)** |

## Retrieval quality by question type (k=10 runs — Recall@10 / Hit@10)

| Run | multi-hop | temporal | single-hop | world-knowledge |
| --- | ---: | ---: | ---: | ---: |
| cdyi | 95.95% | 84.38% | 97.52% | 96.79% |
| mzao | 95.02% | 82.29% | 98.94% | 95.01% |
| py2k | 95.33% | 80.21% | 98.23% | 96.43% |
| em0q | 96.57% | 83.33% | 97.16% | 96.91% |

### py2k (full detail)

| Metric | multi-hop | temporal | single-hop | world-knowledge | overall |
| --- | ---: | ---: | ---: | ---: | ---: |
| Recall@10 | 95.33% | 80.21% | 98.23% | 96.43% | 95.52% |
| Precision@10 | 24.36% | 40.97% | 51.03% | 30.42% | 33.59% |
| F1@10 | 35.85% | 48.64% | 63.07% | 42.53% | 45.28% |
| MRR | 0.901 | 0.726 | 0.916 | 0.902 | 0.894 |
| NDCG | 0.894 | 0.730 | 0.907 | 0.895 | 0.886 |

### em0q (full detail)

| Metric | multi-hop | temporal | single-hop | world-knowledge | overall |
| --- | ---: | ---: | ---: | ---: | ---: |
| Recall@10 | 96.57% | 83.33% | 97.16% | 96.91% | 96.04% |
| Precision@10 | 25.67% | 44.38% | 51.28% | 31.60% | 34.76% |
| F1@10 | 37.50% | 52.30% | 63.02% | 43.82% | 46.55% |
| MRR | 0.910 | 0.772 | 0.906 | 0.914 | 0.903 |
| NDCG | 0.901 | 0.776 | 0.895 | 0.901 | 0.892 |

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
| em0q | 1397 / 2235 | 3048 / 4927 | 2821 / 5037 | 7579 / 11900 |

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
| em0q | 3,852,624 | 2502 | 1610 | 892 |

## Observations

- **Highest accuracy:** `em0q` (k=10) at 91.10% (1403/1540) on 892 context tokens; `9984` (k=25) is next at 90.84% (1399/1540), then `py2k` (k=10) at 90.19% (1389/1540). These three are not statistically distinguishable from each other; `em0q`'s +2.20 pts over `cdyi` (88.90%) is (see the McNemar note below).
- **Temporal swing:** `2n68` jumped temporal accuracy to 79.17% (+6.25 pts vs `mzao`, same ingest) — the largest per-category move across all three runs. Likely driven by the wider candidate pool surfacing date-bearing memories that fall outside the top 10.
- **mzao → 2n68 (same ingest, k=10 → k=20):** +1.62 pts overall (1343 → 1368). Multi-hop dropped (−1.56) while temporal (+6.25) and single-hop (+2.13) gained. Net positive on the same memory store.
- **Retrieval ceiling on k=10 runs:** Hit@10 sits at 94.94–96.04%; failure modes concentrate in answer-generation, not retrieval.
- **1ksp:** Fresh ingest run at k=20 (`dataSourceRunId` is self). Retrieval Recall@20 = 96.56%, MRR = 0.907, NDCG = 0.893. Serves as the ingest source for `rik3`.
- **rik3:** Reuses `1ksp` ingest; only retrieval, answering, and evaluation re-run. Retrieval Recall@20 = 96.43%, MRR = 0.909, NDCG = 0.894. Accuracy +0.39 pts vs `1ksp` on the same memory store (1351 → 1357 correct).
- **Reference (mem0) — artifact-backed on both sides:** **91.10% with GPT-4.1 mini and 10 memories (`em0q`), vs mem0's 91.56% with GPT-5 and 200.** mem0's figures come from their own committed artifact at [`mem0ai/memory-benchmarks@4b61c5d`](https://github.com/mem0ai/memory-benchmarks/blob/4b61c5d/results/platform/locomo_results.json), `results/platform/locomo_results.json`:

  | Cell | Source |
  | --- | --- |
  | 91.56% (1410/1540) | `metrics_by_cutoff.top_200` |
  | GPT-5 | `metadata.answerer_model` / `metadata.judge_model` |
  | 200 retrieved | `metadata.top_k_cutoffs: ["top_200"]`, constant across all 1540 questions |
  | ~7,000 tokens | ⚠️ **blog only** — no token or context field exists anywhere in the artifact |

  Their README advertises 92.5% (1425/1540), which does **not** reproduce from that artifact — a 15-question gap — and its breakdown is labelled "avg across top_10/20/50/200" though the run only evaluated `top_200`. We cite 91.56% because it is the figure they can show their work for. Their `metadata.merged_from_questions` also lists 156 of 1540 questions (10%) carried over from a prior run.

  **The ~7,000 figure must not be used as a denominator in any ratio claim.** It appears only in [their blog post](https://mem0.ai/blog/mem0-the-token-efficient-memory-algorithm) ("Mean tokens: 6,956", per retrieval call), and we cannot establish whether it counts context only or the whole prompt. Our 892 is a measured `avgContextTokens`; theirs is a published claim. The two are not directly comparable.

  mem0's earlier published figure of 82.7% at k=50 is superseded by the above for comparison purposes.
- **ho8o (k=20, fresh ingest):** 88.82% (1367/1539) — consistent with prior k=20 runs. Serves as the ingest source for `9984`. One question was skipped during ingest (1539 vs 1540 total).
- **9984 (k=25, reuses ho8o ingest):** **90.84% (1399/1540) — new all-time best**, up +1.94 pts from cdyi (previous best at 88.90%). All gain comes from widening k from 20 to 25 on the same memory store. Multi-hop improved most (+0.96 vs ho8o), single-hop gained +3.54 pts, and world-knowledge jumped +1.90 pts. Temporal remains the ceiling — only +2.08 pts (72.92% → 75.00%).
- **k=20 → k=25 (same ingest, ho8o → 9984):** +2.02 pts overall. Retrieval Recall@k rose from 95.06% to 96.36%, and MRR improved from 0.887 to 0.896 — the wider candidate pool delivers meaningfully more accurate answers across all question types.
- **py2k (k=10, fresh ingest): 90.19% (1389/1540)** — the highest k=10 point estimate recorded, but see the significance note below before treating it as "best". py2k's retrieval figures read slightly lower than `cdyi`'s (Hit@10 95.52% vs 95.97%, MRR 0.894 vs 0.909), but those are computed against different gold sets (see the gold-set caveat above), so the two are not comparable and **no conclusion about where the accuracy gain originates can be drawn from them.** The gain may well be answer-side; these numbers are not the evidence for it.
- **Significance (paired McNemar over the same 1540 questions):** reports carry per-question `questionId` and a binary `score`, so runs can be compared pair-wise rather than by point estimate alone.

  | Comparison | Discordant pairs | Exact two-sided p | Verdict |
  | --- | --- | ---: | --- |
  | py2k vs `cdyi` | 94 / 74 | 0.142 | **not significant** |
  | py2k vs `mzao` | 114 / 68 | 0.0008 | significant |
  | `cdyi` vs `mzao` | 84 / 58 | 0.036 | significant |
  | em0q vs py2k | 56 / 42 | 0.189 | **not significant** |
  | em0q vs `9984` | 58 / 54 | 0.777 | **not significant** |
  | em0q vs `cdyi` | 99 / 65 | 0.0098 | significant |
  | em0q vs `mzao` | 116 / 56 | < 0.0001 | significant |

  95% Wilson CIs overlap heavily: `cdyi` [87.23%, 90.37%], py2k [88.61%, 91.58%], em0q [89.58%, 92.43%]. **py2k's +1.29 pts over `cdyi` is not statistically distinguishable from run-to-run variance.** A second run at the py2k config is needed before claiming a new best. Note `cdyi` vs `mzao` *is* significant — config-level variation between k=10 runs is real and has historically exceeded the gain published here.

  `em0q` is that second fresh-ingest k=10 run. It lands at 91.10%, inside py2k's interval, so read py2k and em0q together as k=10 holding at ~90–91% rather than em0q as a step up from py2k. Both now beat `cdyi` significantly.
- **Efficiency at constant context cost (the defensible claim):** `mzao` already ran at 966 avg context tokens in April, so py2k's 942 is not a new reduction. What is new is the accuracy at that budget: **87.21% → 90.19% (+2.98 pts, p = 0.0008) at ~950 context tokens.** Holding cost constant, this is both significant and free of the variance objection above. For reference, py2k also beats 88.83% at 1597 tok (`2n68`, k=20) and 87.73% at 1764 tok (`1ksp`, k=20). `em0q` holds this at 892 tokens: 87.21% → 91.10% vs `mzao` (+3.89 pts, p < 0.0001), and it matches `9984`'s k=25 accuracy (p = 0.78) on 37% of its context (892 vs 2412 tokens).
- **Temporal on py2k:** best temporal of any k=10 run (76.04%) *despite* the worst temporal Hit@10 (80.21% vs 84.38% for `cdyi`) and the worst temporal MRR (0.726). Temporal remains the weakest category in every run regardless of k.
- **em0q (k=10, fresh ingest): 91.10% (1403/1540)** — the highest point estimate of any run at any k, on 892 avg context tokens. Same k, answerer, judge and base prompt size (1610 tok) as py2k. Every category moved up vs py2k: multi-hop +1.25, temporal +1.04 (best k=10 temporal at 77.08%), single-hop +0.36, world-knowledge +0.95 pts (93.46%, best of any run). Search latency fell from 1836 to 1397 ms median. The Cohere reranker was applied on every query (`reranker_used` is true on all results), so no part of the run fell back to unreranked search.

## How to add a run

1. Place the run directory under `history/<runId>/` containing `report.json`.
2. Append a row to the headline + per-category tables above and record the run's `k` value.
3. Only include Hit@10 / MRR / nDCG when the run uses the same `k` as the rest of that table; otherwise leave the cells blank with a footnote.
4. Note any methodology changes (multiplier, prompt iteration, ingestion source) in the Observations section.
