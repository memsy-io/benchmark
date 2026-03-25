/**
 * Custom prompts for Memsy provider in MemoryBench.
 *
 * Memsy extracts multiple memory types (episodic, semantic, procedural, etc.)
 * which requires slightly different prompts for answer generation.
 */

import type { ProviderPrompts } from "../../types/prompts"

export const MEMSY_PROMPTS: ProviderPrompts = {
  /**
   * Answer prompt for generating responses from retrieved memories.
   * Memsy returns rich memory objects with type, weight, and metadata.
   */
  answerPrompt: (question: string, context: unknown[], questionDate?: string): string => {
    const memories = context as Array<{
      content: string
      score: number
      metadata?: {
        type?: string
        kind?: string
        weight?: number
        observed_at?: string
        effective_from?: string
        time?: string
        evidence_facts?: string[]
        summary?: string
        entities?: string[]
        composite?: boolean
        source_events?: Array<{ event_id: string; kind: string; content: string; ts: string }>
      }
    }>

    // Separate composite (session overview) memories from atomic evidence memories
    const atomicMemories = memories.filter((m) => !m.metadata?.composite)
    const compositeMemories = memories.filter((m) => m.metadata?.composite)

    const formattedMemories = atomicMemories
      .map((m, i) => {
        const typeLabel = m.metadata?.type || "memory"
        const kindLabel = m.metadata?.kind || ""
        const weight = m.metadata?.weight?.toFixed(2) || "1.00"
        const dateStr = m.metadata?.effective_from || m.metadata?.observed_at || ""
        const dateNote = dateStr ? `, date: ${dateStr}` : ""
        // Prefer summary (concise 1-liner) as the header fact; show full content below.
        const summaryLine = m.metadata?.summary ? `Summary: ${m.metadata.summary}\n` : ""
        const factsNote =
          m.metadata?.evidence_facts && m.metadata.evidence_facts.length > 0
            ? `\nKey facts: ${m.metadata.evidence_facts.join(" | ")}`
            : ""
        const entities = m.metadata?.entities
        const entitiesNote =
          entities && entities.length > 0 ? `\nEntities: ${entities.slice(0, 8).join(", ")}` : ""
        return `[${i + 1}] (${kindLabel}/${typeLabel}, weight: ${weight}${dateNote})\n${summaryLine}${m.content}${factsNote}${entitiesNote}`
      })
      .join("\n\n")

    const backgroundSection =
      compositeMemories.length > 0
        ? `\n\n## Background Context (session overview — use for orientation only, prefer specific memories above for your answer)\n${compositeMemories.map((m) => (m.metadata?.summary ? `- ${m.metadata.summary}` : `- ${m.content.slice(0, 300)}`)).join("\n")}`
        : ""

    // Collect unique source events across all atomic memories (deduplicated by event_id).
    // These are the original raw conversation blobs from which memories were extracted.
    const MAX_EVENT_CHARS = 3000
    const sourceEventMap = new Map<string, { event_id: string; kind: string; content: string; ts: string }>()
    for (const m of atomicMemories) {
      for (const ev of m.metadata?.source_events ?? []) {
        if (!sourceEventMap.has(ev.event_id)) {
          sourceEventMap.set(ev.event_id, ev)
        }
      }
    }
    const conversationSection =
      sourceEventMap.size > 0
        ? `\n\n## Conversation Context (original source text — use for verbatim phrasing and detail not captured in memories above)\n${[...sourceEventMap.values()]
            .map((ev) => ev.content.slice(0, MAX_EVENT_CHARS) + (ev.content.length > MAX_EVENT_CHARS ? "…" : ""))
            .join("\n\n---\n\n")}`
        : ""

    const dateContext = questionDate
      ? `Today's date is ${questionDate}. Consider this when interpreting temporal references.\n\n`
      : ""

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
2. If the answer is directly stated in a single memory, identify it as Memory [N]. Copy the exact text that answers the question — same words, same order, same capitalisation. Do NOT substitute synonyms, reorder words, or drop words from the middle. Only trim leading/trailing context if needed. Your Answer: line must be a verbatim substring of Memory [N] — verify this before writing it.
3. If the answer requires linking facts across memories (e.g. first find who X's friend is, then find what that person does), follow the chain step by step: state the intermediate entity, find the memory that names it, then proceed to the next fact.
4. For date or time questions, use the "date:" field on the relevant memory together with the memory text to determine when the event occurred. Use an exact date where possible (e.g. "7 May 2023"). If the question asks for a duration or relative time, compute it using today's date provided above.
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

Reasoning:
[Your step-by-step reasoning]

Answer:
[Your complete, specific final answer — include ALL qualifiers from your reasoning]`
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
    hypothesis: string
  ): { default: string; [type: string]: string } => {
    const lastAnswerIdx = hypothesis.lastIndexOf("\nAnswer:")
    const extracted =
      lastAnswerIdx !== -1
        ? hypothesis.slice(lastAnswerIdx + "\nAnswer:".length).trim()
        : hypothesis.trim()

    const judgeBody = `Respond with ONLY a JSON object:
{"score": 1, "label": "correct", "explanation": "..."} if the response contains the correct answer
{"score": 0, "label": "incorrect", "explanation": "..."} if the response does not contain the correct answer

Question: ${question}
Ground Truth Answer: ${groundTruth}
System's Hypothesis: ${extracted}`

    const basePrompt = `I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response is equivalent to the correct answer or contains all the intermediate steps to get the correct answer, you should also answer yes. If the response only contains a subset of the information required by the answer, answer no.

${judgeBody}`

    const temporalPrompt = `I will give you a question, a correct answer, and a response from a model. Please answer yes if the response contains the correct answer. Otherwise, answer no. If the response is equivalent to the correct answer or contains all the intermediate steps to get the correct answer, you should also answer yes. If the response only contains a subset of the information required by the answer, answer no. In addition, do not penalize off-by-one errors for the number of days. If the question asks for the number of days/weeks/months, etc., and the model makes off-by-one errors (e.g., predicting 19 days when the answer is 18), the model's response is still correct.

${judgeBody}`

    return {
      default: basePrompt,
      temporal: temporalPrompt,
    }
  },
}
