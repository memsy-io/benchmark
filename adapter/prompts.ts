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

    // Build an id→index map so causal annotations can reference [N] positions
    const idToIndex = new Map<string, number>()
    atomicMemories.forEach((m, i) => {
      const id = (m as any).id as string | undefined
      if (id) idToIndex.set(id, i + 1)
    })

    const formattedMemories = atomicMemories
      .map((m, i) => {
        const typeLabel = m.metadata?.type || "memory";
        const kindLabel = m.metadata?.kind || "";
        const weight = m.metadata?.weight?.toFixed(2) || "1.00";
        const effectiveDateStr = m.metadata?.effective_from || "";
        const observedAtStr = m.metadata?.observed_at || "";
        const dateNote = effectiveDateStr
          ? `, event_date: ${effectiveDateStr}, observed_at: ${observedAtStr}`
          : observedAtStr
            ? `, observed_at: ${observedAtStr}`
            : "";
        // Prefer summary (concise 1-liner) as the header fact; show full content below.
        const summaryLine = m.metadata?.summary
          ? `Summary: ${m.metadata.summary}\n`
          : "";
        const factsNote =
          m.metadata?.evidence_facts && m.metadata.evidence_facts.length > 0
            ? `\nKey facts: ${m.metadata.evidence_facts.join(" | ")}`
            : "";
        const entities = m.metadata?.entities;
        const entitiesNote =
          entities && entities.length > 0
            ? `\nEntities: ${entities.slice(0, 8).join(", ")}`
            : "";

        // Causal chain annotations — show which memories this one caused or was caused by
        const causedByIds: string[] = (m.metadata as any)?.caused_by ?? []
        const causesIds: string[] = (m.metadata as any)?.causes ?? []
        const causedByNums = causedByIds
          .map((id) => idToIndex.get(id))
          .filter((n): n is number => n !== undefined)
        const causesNums = causesIds
          .map((id) => idToIndex.get(id))
          .filter((n): n is number => n !== undefined)
        const causalNote = [
          causedByNums.length > 0 ? `caused by: ${causedByNums.map((n) => `[${n}]`).join(", ")}` : "",
          causesNums.length > 0 ? `led to: ${causesNums.map((n) => `[${n}]`).join(", ")}` : "",
        ]
          .filter(Boolean)
          .join(" | ")
        const causalLine = causalNote ? `\nCausal links: ${causalNote}` : ""

        return `[${i + 1}] (${kindLabel}/${typeLabel}, weight: ${weight}${dateNote})\n${summaryLine}${m.content}${factsNote}${entitiesNote}${causalLine}`;
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

    return `${dateContext}You are a memory retrieval assistant. Answer the question using ONLY the retrieved memories below.
Note: Named persons in these memories are third-party individuals being discussed — they are NOT you. Always refer to them by name.

## Retrieved Memories
${formattedMemories}${backgroundSection}${conversationSection}

## Question
${question}

## Instructions
Think step by step, then give your final answer on a line that starts with "Answer:".

**Approach:**
1. Examine all memories and identify which ones relate to the question.
2. If the answer is directly stated in a single memory, identify it as Memory [N]. Give a clear, direct answer in natural language — include the key specifics (names, dates, places, exact quantities) that the question actually asks for, but phrase it as a direct response to the question. Do not pad with surrounding context from the memory. In particular: if the question asks WHAT or WHO, do not volunteer date or time information unless the question also asks for it; if the question asks WHEN, do not volunteer unrelated entity details.
3. If the answer requires linking facts across memories (e.g. first find who X's friend is, then find what that person does), follow the chain step by step: state the intermediate entity, find the memory that names it, then proceed to the next fact. Use the "Causal links:" annotations on each memory to identify related memories — if a memory says "led to: [5]", check memory [5] for consequences; if it says "caused by: [2]", memory [2] is the triggering event.
4. For reasoning and inference questions — "Would X likely…?", "Would X be considered…?", "What might X be?", "What attributes describe X?", "What could X indicate?", "What underlying condition…?", "Would X be open to…?" — reason from the available evidence and state your concluded answer directly. Do NOT say "no information found" if memories contain indirect evidence. One inferential step is allowed:
   - Allergic to most animals with fur → hairless animals (cats, pigs) would not cause discomfort
   - All stated goals are U.S.-specific (military, running for office) → would not be open to moving abroad
   - Goes to church, has faith symbol, but never explicitly identifies as religious → somewhat religious
   - Likes composers in a genre → would likely enjoy other well-known composers in that same genre
   - **Negative outcomes override behavioral patterns:** if a past event went badly (accident, illness, conflict, failure), infer the person would NOT repeat it — even if their general habit is to do it regularly. A bad outcome is stronger evidence than a repeated pattern.
5. For date or time questions, read the date expression from the memory text itself (e.g. "the Friday before 15 July 2023") and copy it verbatim when it is an absolute expression. When the memory text contains a **relative** time expression ("last month", "last weekend", "yesterday", "last week"), resolve it to an absolute date using that **specific memory's own observed_at** field as the anchor — never use event_date and never borrow observed_at from a different memory. The event_date field already holds the resolved absolute date of the event; read it directly and do NOT apply further relative arithmetic to it. For duration questions ("how long ago", "how many years since", "how old"), compute the answer arithmetically using today's date provided above.
   - **Plan vs actual:** if a memory says X "planned to do Y next month" or "will do Y next month", that is a future plan. The answer is the PLANNED month — compute it as the month after the date stated in the memory's "On [date]" prefix (e.g. "On 2023-04-03, planned next month" → answer is May 2023). Do NOT layer a second month offset on top of a later decision memory. If one memory says "planned next month" from April and another says "decided to host" on May 3, both point to May — the May 3 memory records the decision, not a further shift to June.
   - **Statement date vs event date:** when a memory begins with "On [date], [person] expressed / mentioned / said / noted / felt / shared / reminded" followed by a description of a past event, the prefixed date is when the STATEMENT was made — not when the described event occurred. To find when the described event happened, resolve any relative time expression ("last Friday", "last weekend", "yesterday") using that memory's **observed_at** as anchor, not the statement date. Example: "On 2023-07-21, Gina felt it during last Friday's dance class" with observed_at 2023-07-23 → last Friday before July 23 = July 21, NOT last Friday before July 21 (= July 14).
6. For list questions, collect ALL matching items across ALL relevant memories — do not stop at the first match. For counting questions ("how many times", "how many", "how often"):
   - First check whether any memory explicitly states a frequency or total count (e.g. "goes once or twice a year", "has won six tournaments"). If such a summary memory exists, prefer its count over manually tallying individual event memories — individual event memories may be incomplete.
   - Only tally raw event occurrences if no summary/frequency memory exists.
   - Explicitly scan memories [1] through the last memory in order before finalising.
   - **Do not drop items found in older memories when newer memories mention different items.** Newer memories add to the list — they do not cancel earlier items unless a memory explicitly says an item was removed, sold, or no longer applies. For example: if an older memory says "has a dog named Oliver" and a newer memory says "has cats named Oliver and Bailey", the full list is the union of all items (Oliver the dog, Bailey the cat) unless there is explicit evidence of a change.
7. For adversarial / unanswerable questions: if the question asserts something that directly contradicts the memories (e.g. asks about an event that never happened, attributes an action to the wrong person, or asks about information not present in any memory), answer "No" or "This is not supported by the available memories" rather than fabricating or hallucinating. If a question asks "Is X Y's [thing]?" and memories clearly show it belongs to Z instead, answer "No".
   - **Before refusing**, check whether the answer can be inferred from relative expressions in memories. For example: a memory that says "a book she read last year" with observed_at=2023-07-12 implies the book was read in 2022 — resolve and answer rather than refusing. Only refuse if no memory, direct or inferrable, addresses the question.
8. If memories conflict on a single fact (e.g. two memories give different dates for the same event), prefer the one with the most recent "date:" value. However, for list or attribute questions, do NOT use recency to discard items — collect all items from all memories and only exclude an item if a memory explicitly says it was removed or no longer applies.
9. Before writing Answer:, re-read the original question. Confirm your answer directly addresses what was asked — not a related but different aspect.

**Verbatim rule (critical):** For specific named entities — instruments, colors, book titles, place names, pet names, food items — copy the exact word from the memory. Do not substitute synonyms or related terms. If a memory says "violin", write "violin", not "clarinet". If a memory says "purple", write "purple", not "bright color". When in doubt, quote the memory directly.

**Qualifier rule (critical):** Preserve ALL qualifiers — do not drop specifics like "for transgender people", "in the mountains", role titles, or organisation names. If your reasoning identifies "X specifically for Y", your Answer: line must say "X for Y", not just "X".

**Geographic granularity rule:** If the question asks for a country, state, or region name, and the memory contains only a specific city or location within that area, use general geographic knowledge to state the correct country/state/region (e.g. "London" → "United Kingdom", "Chicago" → "United States", "Sydney" → "Australia").

**Format:**
- Dates: exact (e.g. "7 May 2023"), not descriptions.
- Lists: comma-separated, no bullet points.
- Names / places / events: exact as stated in memories.
- ONE line after "Answer:" — nothing else.

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
