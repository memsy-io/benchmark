/**
 * Custom prompts for Memsy provider in MemoryBench.
 *
 * Memsy extracts multiple memory types (episodic, semantic, procedural, etc.)
 * which requires slightly different prompts for answer generation.
 */

import type { ProviderPrompts } from "../../types/prompts";

function humanDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

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
        // Arm 3 (never-flip): predecessors this memory superseded, surfaced as
        // annotations rather than hidden. This list MUST be declared here and
        // rendered below — this prompt builds from an explicit metadata field
        // list, so an unlisted metadata key is invisible to the model and arm 3
        // silently degrades into an exact copy of arm 2.
        superseded?: Array<{
          id: string;
          text: string;
          effective_from: string | null;
        }>;
      };
    }>;

    // Separate composite (session overview) memories from atomic evidence memories
    const atomicMemories = memories.filter((m) => !m.metadata?.composite);
    const compositeMemories = memories.filter((m) => m.metadata?.composite);

    // Preserve retrieval/reranker order — the most relevant memories appear first.
    // Each memory still carries a human-readable date label so the LLM can reason
    // about timelines without losing the relevance signal from the reranker.
    const formattedMemories = atomicMemories
      .map((m, i) => {
        const iso = m.metadata?.effective_from || m.metadata?.observed_at;
        const display = humanDate(iso) || iso || "unknown date";
        // Arm 3: show what this memory replaced, explicitly marked stale. The
        // wording has to make obsolescence unmissable — the point of the arm
        // is to test whether the model can use a superseded fact as context
        // while still answering with the current one.
        const superseded = m.metadata?.superseded;
        const supersededNote =
          superseded && superseded.length > 0
            ? `\nPreviously (now SUPERSEDED — do not answer with this):\n${superseded
                .map((s) => {
                  const when = humanDate(s.effective_from ?? undefined) || s.effective_from;
                  return `  - "${s.text}"${when ? ` (as of ${when})` : ""}`;
                })
                .join("\n")}`
            : "";
        return `[${i + 1}] (${display})\n${m.content}${supersededNote}`;
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

    // Only emit a date anchor when the harness supplies an explicit question date.
    // Falling back to the latest memory date produces wrong anchors for temporal questions.
    const dateContext = questionDate
      ? `Today's date is ${questionDate}. Consider this when interpreting temporal references.\n\n`
      : "";

    return `${dateContext}You are a memory retrieval assistant. Named persons in these memories are third-party individuals — always refer to them by name.

## Question
${question}

## Instructions
Think step by step, then give your final answer on a line that starts with "Answer:".

**Approach:**
1. Examine all memories and identify which ones relate to the question. A memory at position 10 or 15 is just as likely to contain the answer as one at position 1 — do not give higher weight to higher-ranked memories. The correct answer may be scattered across several memories; check every one.
2. If the answer is directly stated in a single memory, identify it as Memory [N]. Always prefer the most specific fact available: an exact name, title, number, or precise activity beats a generic description of the same thing. If one memory says "a romantic drama" and another says "The Notebook", use "The Notebook". A single memory may contain multiple distinct facts joined by commas or "and" — check each component independently against the question.
3. If the answer requires linking facts across memories (e.g. first find who X's friend is, then find what that person does), follow the chain step by step: state the intermediate entity, find the memory that names it, then proceed to the next fact. The intermediate entity's memory may be anywhere in the list — scan all memories for it before concluding.
4. For date or time questions, use the "date:" field on the relevant memory to determine when the event occurred. Use an exact date where possible (e.g. "7 May 2023"). For duration questions ("how long did X last", "how many days/weeks between X and Y"), locate the start and end event memories, read their date fields, and compute the difference explicitly in your reasoning. If a memory has no "date:" field, fall back to its observed_at timestamp. For durations relative to now, compute using today's date provided above.
5. **List/count rule:** For list questions ("which", "what kinds of", "what are X's …") and counting questions ("how many"), scan every memory [1] through [${atomicMemories.length}] in order and explicitly enumerate each distinct matching item before answering. Do not stop at the first match. Re-count after enumeration: the number of items in your Answer line must equal the number you listed in your reasoning.
   **Dedup rule:** Multiple memories often describe the SAME event from different perspectives (e.g. person A reacting to person B's rejection, person B receiving the same rejection). Before counting, group memories that refer to the same underlying event into ONE occurrence. Two memories about the same rejection letter = one rejection. Two memories about the same beach visit = one beach visit. Only count distinct real-world events, not distinct memory entries.
6. **Conflict rule (same fact only):** When two memories give CONTRADICTORY information about the SAME single fact (e.g., one says "Melanie works at Company A", another says "Company B"), prefer the memory with the more recent "date:" value. Do NOT apply this when memories describe DIFFERENT events at different times — those can all be true simultaneously. CRITICAL: Never apply this to lists — lists accumulate across all memories regardless of date. If Memory [A] mentions items X and Y, and Memory [B] mentions items Y and Z, the complete answer is X, Y, and Z.
   **Superseded rule:** Any text under "Previously (now SUPERSEDED...)" is a fact that has ALREADY been replaced by the memory it sits under. Use it only to understand what changed, and never as the answer itself. If the question asks what something used to be, or when it changed, that superseded text is the correct evidence — but for any question about the present, answer with the memory above it, not the superseded text beneath it.
   **Recency questions:** When the question asks what someone did "recently" or "most recently", scan ALL memories and find the one with the most recent event date that matches the question's subject. Recency is determined by the event date in the memory, not by the memory's position in the list. A less-specific memory dated later beats a more-specific memory dated earlier for recency questions.
   **Start-date questions:** When asked "when did X start/begin", use the date of the EARLIEST memory that describes X as ongoing, planned, or active — even if that memory uses present tense. "Jon is expanding his social media presence" dated 2023-04-03 means expansion started by April 2023.
7. Before writing Answer:, re-read the original question. Confirm your answer directly addresses what was asked — not a related but different aspect. When you have identified multiple plausible answers and cannot determine which is definitively correct, choose the one with the most direct support from the highest-scoring (lowest-numbered) retrieved memories.

**No-hedge rule:** If any retrieved memory addresses the topic of the question — even partially, paraphrased, or implicitly — you must give a substantive answer drawn from those memories. Do not respond with phrases like "no information available", "not specified", "no record", or "the memories do not specify" when relevant memories were retrieved. If the answer is paraphrased in the memory, restate the closest matching factual content directly.

**Plan vs event rule:** When the question asks what someone "is planning", "is going to", "intends to", or "will" do, return the date or content of the memory expressing the intent — typically the earliest such memory — not a later memory describing the actual execution. The "prefer most recent on conflict" guidance applies to factual conflicts, not to the plan→event progression.

**Did vs available rule:** Report what someone actually did or experienced, not what was merely offered, available, or suggested to them. "Has not tried X yet", "was offered X", "was thinking about X" all mean X was NOT done — disqualify X as a done activity. Only use memories that affirm the action actually happened.

**Temporal year rule:** Events in these memories occurred in 2022–2024. Do not output years like 2025 or 2026 for events described in the memories — those are the current year, not when conversations happened. When computing durations or "how long ago", calculate relative to the conversation date, not today.

**Relative-date rule:** If a source memory describes the timing of an event using a relative phrase (e.g. "the weekend before X", "a few days before Y", "the Sunday after Z"), return that relative phrasing verbatim in your answer rather than computing an absolute date from it. Convert to an absolute date only when the memory itself uses an absolute date.

**Anchor date warning:** Do not use the prompt's "Today's date is …" line as your answer to a "when" or "what date" question. That line is only context for resolving relative phrasing like "yesterday" or "last week" inside memory text.

**Name variants:** People may be referred to by different name forms across the question and memories (e.g. "Jon"/"John", "Jean"/"Gina"). If context makes clear two name variants refer to the same person, treat them as the same person.

**Qualifier rule:** Preserve every modifier from the source memory in your answer. Do not shorten descriptive noun phrases to a head noun, do not generalize a specific term to its category, and do not drop adjectives, prepositional phrases, or trailing details that are present in the memory. If your reasoning identified a modifier, the Answer line must contain it.

**Format:**
- Dates: exact (e.g. "7 May 2023") when the memory uses an absolute date. When the memory uses a relative phrase, see the Relative-date rule above.
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

    const unifiedPrompt = `Your task is to evaluate whether a system's response correctly answers a question about information from prior conversations between users.

Grading rules (apply to every question):
1. PARTIAL CREDIT FOR LISTS: If the ground truth contains multiple items and the response includes AT LEAST ONE correct item, mark correct. Only mark incorrect if NONE of the items match.
2. PARAPHRASES COUNT: Same concept in different words is correct. "Chocolate raspberry tart" = "chocolate cake with raspberries". "Shelter meal service" = "volunteering at a homeless shelter". Emotions in the same positive/negative family count: "proud" = "fulfilled" = "accomplished"; "huge success" = "relieved" = "thrilled" (all express positive achievement). Judge semantic meaning, not exact wording.
3. EXTRA DETAIL IS FINE: A longer answer that includes the key facts plus additional detail is correct. Never penalize for being more specific.
4. DATE TOLERANCE: Dates within 14 days of each other are correct. Durations within 50% are correct (e.g. "5 months" matches "six months"; "19 days" matches "two weeks"). Relative dates ("few days before November") match specific dates in the same window. A specific date consistent with a vague reference is correct. Converting a relative phrase to the correct absolute date is correct.
5. SEMANTIC OVERLAP: Judge whether the response addresses the same topic and captures the core idea of the ground truth. Different wording or detail level should not result in incorrect if the underlying concept matches.
6. SAME REFERENT: If the response identifies the same person, place, or entity as the ground truth — even with different descriptors or additional detail — mark correct.
7. FOCUS ON KNOWLEDGE, NOT WORDING: The goal is to assess whether the system recalled the right fact. Minor differences in specificity, phrasing, or scope are not grounds for incorrect. Only mark incorrect when the response demonstrates genuinely different or wrong understanding.

${judgeBody}`;

    return {
      default: unifiedPrompt,
    };
  },
};
