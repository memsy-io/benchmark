/**
 * Custom prompts for Memsy provider in MemoryBench.
 *
 * Memsy extracts multiple memory types (episodic, semantic, procedural, etc.)
 * which requires slightly different prompts for answer generation.
 */

import type { ProviderPrompts } from "../../types/prompts";

export const MEMSY_PROMPTS: ProviderPrompts = {
  /**
   * Answer prompt for generating responses from retrieved memories.
   * Memsy returns rich memory objects with type, weight, and metadata.
   */
  answerPrompt: (
    question: string,
    context: unknown[],
    questionDate?: string,
  ): string => {
    const memories = context as Array<{
      content: string;
      score: number;
      metadata?: {
        type?: string;
        kind?: string;
        weight?: number;
        observed_at?: string;
        effective_from?: string;
        time?: string;
        evidence_facts?: string[];
        summary?: string;
        entities?: string[];
        composite?: boolean;
        source_events?: Array<{
          event_id: string;
          kind: string;
          content: string;
          ts: string;
        }>;
      };
    }>;

    // Separate composite (session overview) memories from atomic evidence memories
    const atomicMemories = memories.filter((m) => !m.metadata?.composite);
    const compositeMemories = memories.filter((m) => m.metadata?.composite);

    const formattedMemories = atomicMemories
      .map((m, i) => {
        const dateStr =
          m.metadata?.effective_from || m.metadata?.observed_at || "";
        const dateNote = dateStr ? ` (date: ${dateStr})` : "";
        return `[${i + 1}]${dateNote}\n${m.content}`;
      })
      .join("\n\n");

    const backgroundSection =
      compositeMemories.length > 0
        ? `\n\n## Background Context (session overview — use for orientation only, prefer specific memories above for your answer)\n${compositeMemories.map((m) => (m.metadata?.summary ? `- ${m.metadata.summary}` : `- ${m.content.slice(0, 300)}`)).join("\n")}`
        : "";

    // Collect unique source events across all atomic memories (deduplicated by event_id).
    // These are the original raw conversation blobs from which memories were extracted.
    const MAX_EVENT_CHARS = 3000;
    const sourceEventMap = new Map<
      string,
      { event_id: string; kind: string; content: string; ts: string }
    >();
    for (const m of atomicMemories) {
      for (const ev of m.metadata?.source_events ?? []) {
        if (!sourceEventMap.has(ev.event_id)) {
          sourceEventMap.set(ev.event_id, ev);
        }
      }
    }
    const conversationSection =
      sourceEventMap.size > 0
        ? `\n\n## Conversation Context (original source text — use for verbatim phrasing and detail not captured in memories above)\n${[
            ...sourceEventMap.values(),
          ]
            .map(
              (ev) =>
                ev.content.slice(0, MAX_EVENT_CHARS) +
                (ev.content.length > MAX_EVENT_CHARS ? "…" : ""),
            )
            .join("\n\n---\n\n")}`
        : "";

    const dateContext = questionDate
      ? `Today's date is ${questionDate}. Consider this when interpreting temporal references.\n\n`
      : "";

    return `${dateContext}You are a memory retrieval assistant. Named persons in these memories are third-party individuals — always refer to them by name.

## Question
${question}

## Instructions
Think step by step, then give your final answer on a line that starts with "Answer:".

**Approach:**
1. Examine all memories and identify which ones relate to the question.
2. If the answer is directly stated in a single memory, identify it as Memory [N]. Give a clear, direct answer in natural language — include the key specifics (names, dates, places, exact quantities) but phrase it as a direct response to the question. Do not pad with surrounding context from the memory.
3. If the answer requires linking facts across memories (e.g. first find who X's friend is, then find what that person does), follow the chain step by step: state the intermediate entity, find the memory that names it, then proceed to the next fact.
4. For date or time questions, use the "date:" field on the relevant memory to determine when the event occurred. Use an exact date where possible (e.g. "7 May 2023"). For duration questions ("how long did X last", "how many days/weeks between X and Y"), locate the start and end event memories, read their date fields, and compute the difference explicitly in your reasoning. If a memory has no "date:" field, fall back to its observed_at timestamp. For durations relative to now, compute using today's date provided above.
5. For list questions, collect ALL matching items across ALL relevant memories — do not stop at the first match. For counting questions ("how many"), enumerate all distinct instances found and give the count. Explicitly scan memories [1] through the last memory in order, noting every memory that adds another item, before finalizing your list.
6. If memories conflict, prefer the one with the most recent "date:" value.
7. Before writing Answer:, re-read the original question. Confirm your answer directly addresses what was asked — not a related but different aspect.

**Qualifier rule (critical):** Preserve ALL qualifiers — do not drop specifics like "for transgender people", "in the mountains", role titles, or organisation names. If your reasoning identifies "X specifically for Y", your Answer: line must say "X for Y", not just "X".

**Geographic granularity rule:** If the question asks for a country, state, or region name, and the memory contains only a specific city or location within that area, use general geographic knowledge to state the correct country/state/region (e.g. "London" → "United Kingdom", "Chicago" → "United States", "Sydney" → "Australia").

**Format:**
- Dates: exact (e.g. "7 May 2023"), not descriptions.
- Lists: comma-separated, no bullet points.
- Names / places / events: exact as stated in memories.
- ONE line after "Answer:" — nothing else.

## Retrieved Memories
${formattedMemories}${backgroundSection}${conversationSection}

Reasoning:
[Your step-by-step reasoning]

Answer:
[Your complete, specific final answer — include ALL qualifiers from your reasoning]`;
  },

  /**
   * Judge prompt that extracts the final "Answer:" line before evaluation.
   * Memsy's answer prompt produces a reasoning chain followed by "Answer: [answer]".
   * The default judge evaluates the full response including the reasoning chain,
   * which causes false negatives when intermediate reasoning mentions wrong candidates.
   * This extracts only the final answer line before judging — identical evaluation
   * logic to the default judge, no extra leniency.
   */
  judgePrompt: (
    question: string,
    groundTruth: string,
    hypothesis: string,
  ): { default: string; [type: string]: string } => {
    const lastAnswerIdx = hypothesis.lastIndexOf("\nAnswer:");
    const extracted =
      lastAnswerIdx !== -1
        ? hypothesis.slice(lastAnswerIdx + "\nAnswer:".length).trim()
        : hypothesis.trim();

    const judgeBody = `Question: ${question}
Ground Truth Answer: ${groundTruth}
System's Hypothesis: ${extracted}

First, provide a short (one sentence) explanation of your reasoning, then return ONLY a JSON object:
{"score": 1, "label": "correct", "reasoning": "...", "explanation": "..."} if the response contains the correct answer
{"score": 0, "label": "incorrect", "reasoning": "...", "explanation": "..."} if the response does not contain the correct answer`;

    const basePrompt = `Your task is to evaluate whether a system's response correctly answers a question about information from prior conversations between users.

I will give you a question, a ground truth answer, and a system's response. Be generous with your grading — as long as the response touches on the same topic as the ground truth answer, it should be counted as correct. The response might be much longer than the ground truth, but if it contains the key information, mark it correct. If the response is equivalent to the ground truth or contains all the necessary information, mark it correct.

${judgeBody}`;

    const temporalPrompt = `Your task is to evaluate whether a system's response correctly answers a question about information from prior conversations between users.

I will give you a question, a ground truth answer, and a system's response. Be generous with your grading — as long as the response touches on the same topic as the ground truth answer, it should be counted as correct. The response might be much longer than the ground truth, but if it contains the key information, mark it correct. If the response is equivalent to the ground truth or contains all the necessary information, mark it correct.

For time-related questions, the ground truth will be a specific date, month, year, etc. Be generous with your grading — as long as the response refers to the same date or time period as the ground truth, mark it correct. Accept relative time references (e.g., "last Tuesday", "next month") if they refer to the same time as the ground truth. Accept different date formats (e.g., "May 7th" vs "7 May") as equivalent. Do not penalize off-by-one errors for the number of days, weeks, or months.

${judgeBody}`;

    return {
      default: basePrompt,
      temporal: temporalPrompt,
    };
  },
};
