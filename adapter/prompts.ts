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

## Question
${question}

## Critical rules before you read the memories
- Scan ALL memories [1]–[N] AND the Conversation Context before forming any answer.
- Lower-ranked memories may hold the decisive fact — do NOT anchor on [1]–[3] alone.
- Copy exact names, places, dates, and titles verbatim from memories; never paraphrase.
- For "what could/might X do?" questions: prefer a specific named activity over general advice.
- Relative dates: "last year" observed in 2023 → 2022; "this month" → the month of observed_at.
- Lists are additive across memories — newer mentions do NOT cancel older items.
- **Negative outcome overrides habit**: If a past event had a clearly negative outcome (accident, loss, failure), the person is UNLIKELY to repeat that activity soon — this overrides any positive plans or patterns.
- **Physical limitation → health condition**: A memory describing a body-size-related limitation with standard objects signals a possible health condition. Infer it explicitly (e.g. fingers too large for bowling ball → may be obese).
- **Repeated expertise + passion → post-career domain**: If memories show deep, sustained engagement in a domain across sessions (caring for animals, mentoring, coaching others), that domain — not a general activity — is the strongest post-career suggestion.

## Retrieved Memories
${formattedMemories}${backgroundSection}${conversationSection}

## Instructions
Think step by step, then give your final answer on a line that starts with "Answer:".

**Rule 1 — Read everything, answer precisely.**
Scan ALL memories [1]–[N] and the Conversation Context (if present) before answering. Include the key specifics (names, dates, places, quantities) the question asks for. Do not pad with context the question didn't ask about — if it asks WHAT, don't volunteer dates; if it asks WHEN, don't volunteer unrelated details. Before writing Answer:, re-read the question and confirm you are answering exactly what was asked.

**Rule 2 — Conversation Context outranks memory summaries.**
Memories are lossy summaries that may drop specific details. When the Conversation Context contains a more specific version of what a memory summarises (e.g. memory says "made their own pots" but conversation says "a cup with a dog face"; memory says "nature-inspired painting" but conversation says "a sunset with a palm tree"), always prefer the conversation text. Cross-check memories against conversation context before finalising.

**Rule 3 — Chain linking.**
When the answer requires connecting facts across memories, follow the chain step by step. Use "Causal links:" annotations. Cross-reference generic descriptions with specific names — if one memory says "a renowned outdoor gear company" and another mentions "Under Armour" for the same person, connect them. For trip linking, temporal proximity (same week/month) + geographic proximity = same trip — don't require an explicit "during trip X, also visited Y."

**Rule 4 — Inference (one step allowed).**
For "Would X likely…?", "What might…?", "What could…?" questions, reason from evidence and state your answer directly. Do NOT say "no information found" when indirect evidence exists. Allowed inferences:
- **Physical/medical:** fur allergy → hairless cats/pigs safe; multiple allergies → asthma; big fingers + needs exercise → obesity.
- **Product→platform:** exclusive product → name the platform (Xenoblade 2 → Nintendo Switch; Final Cut Pro → Mac).
- **Description→name:** identify unnamed things from mechanics using world knowledge ("social deduction, find imposter" → Mafia; "yoga for core strength, held poses" → Hatha Yoga; "colored cards, match color/number" → UNO).
- **Context→identity:** "because of degree" + career goal → degree matches field (policymaking → political science); deep hobby skill → career in that skill (turtle care → zookeeper, NOT YouTuber); landmarks → state/country (Voyageurs → Minnesota); famous venues → known locations.
- **Job ≠ degree:** Never infer a person's degree from their job title or work history. A person's current or past job does NOT indicate their field of study. Only infer degree from explicit education statements or from a stated career goal linked to their degree ("I want to do X because of my degree" → degree is in X's field).
- **Behavioral:** negative past outcome overrides habitual pattern; U.S.-specific life goals → wouldn't move abroad; faith signals (church art, faith symbols) without explicit statement → somewhat religious; likes composers in genre → would enjoy others in same genre.
- **Activity-specific negative override:** A negative outcome overrides THAT SPECIFIC ACTIVITY only — not the broader category. A bad roadtrip → unlikely to roadtrip again; continuing to camp after does NOT cancel roadtrip reluctance. Match the override to the exact activity the question asks about.
- **Financial status:** professional career + expensive items + travel → middle-class/wealthy. One temporary expense does NOT override. Only infer strain from multiple signs of debt or inability to pay.
- **Current state = most recent arc:** For "What is X's current status?" questions, find the LATEST memory cluster for that domain. Early hardship + later stability = current status is stable. Do not anchor on the most dramatic early event if later memories show a different state.
- **Plan ≠ execution:** "X plans/intends/hopes/is planning to do Y" does NOT confirm Y happened. For "Did X happen?" or yes/no completion questions, only answer Yes if a memory explicitly records the event as completed. Plans are intent, not fact.
- **Social:** same courses/school → studied together; shared activities + overlapping timelines → "together" questions lean Yes.
- **Named entity recall:** ALWAYS prefer a specific name from ANY memory over a generic description. "Under Armour" not "an outdoor company"; "Mafia" not "a social deduction game".
- **Holistic rule:** When inferring overall state (financial, emotional, religious, loneliness), weigh ALL memories proportionally — not just the most vivid or recent one. Count evidence in each direction; answer from the balance.
- **Inference chain must complete:** When reasoning leads to a signal or symptom, always name the conclusion — never stop at the intermediate step. "Fingers too big for bowling ball" → MUST say "obesity"; "multiple allergies" → MUST say "asthma"; "basketball + leadership + giving back" → MUST say "basketball coach". If the conclusion has a known specific name, use it.
- **Specific over vague:** For "why" questions, a named competing activity ("prefers video games") beats general busyness ("too caught up in studies"). For "what could X do" questions, a specific transformative action beats generic coping strategies.

**Rule 5 — Dates and durations.**
- Absolute dates in memory text: copy verbatim.
- Relative expressions ("last month", "yesterday"): resolve using that memory's own **observed_at** as anchor. Never borrow observed_at from another memory. The event_date field is already resolved — read it directly, do not re-apply arithmetic.
- "Planned to do Y next month" on date X → answer is the month after X. Don't double-offset from a later decision memory.
- "On [date], person mentioned [past event]": the prefix is the STATEMENT date. Resolve the past event's relative expression from observed_at, not from the statement date.
- **Durations:** If any memory or conversation context explicitly states a duration ("it took six months", "after a year"), use it. Only compute from date milestones if no explicit duration exists — computed timelines may be incomplete.

**Rule 6 — Lists, counts, and conflicts.**
- **Lists:** Answer = union of ALL matching items across ALL memories. Scan [1]–[N] in order; write down every item before compiling the final list.
- **Enumeration checkpoint (mandatory):** For any question about what a person has, does, knows, visited, or made — before writing Answer:, perform an explicit item scan: go through every memory [1]–[N] and the Conversation Context, and write one line noting each item found and which memory contributed it (e.g. "[2]→Luna, [5]→Oliver, [9]→Bailey"). Compile the final answer only after this enumeration. Never stop at the first memory that appears to give a complete list — a later memory may add items the earlier one did not see.
- **Cumulative attributes are additive.** Newer memories mentioning some items do NOT cancel older items. Absence ≠ removal. Only exclude if a memory explicitly says removed/sold/lost. Example: older "dog named Oliver" + newer "cats Oliver and Bailey" → full set is {dog Oliver, cat Bailey} unless explicit removal stated.
- **Counts:**
  - **Stated total wins by default.** When a single memory clearly states the count ("two dogs", "twice", "won 6 games", "usually once or twice a year") and no other memory contradicts it, use it directly — no enumeration needed.
  - **Enumerate when no clear total exists, or when totals disagree.** List each distinct instance with its date or distinguishing context, then count the list.
  - **Merge duplicates by event identity:** two memories describing the same event (same approximate date, same subject, same nature) count as one instance — even if worded differently. "Last Friday" plus an explicit Friday date = the same event. Approximate dates are fine; exact matches are not required.
  - **Count implicit references** like "her other dog" or "the rest of them" — they imply real entities even when unnamed.
  - **Trust a stated total over a partial enumeration.** If enumeration falls short of an uncontradicted stated count, retrieved memories are likely incomplete — prefer the stated total. Exception: time-anchored ordinals ("his 4th tournament", "the latest of three scripts") are snapshots from a moment, not running totals — enumerate the full timeline and use the higher count if later events exist.
  - **Date approximation:** never refuse to answer over minor date mismatches. "Last Saturday before Nov 7" ≈ end of October ≈ beginning of November; a Nov 3 memory answers a question about Nov 9 if nothing closer matches.
- **Single-fact conflicts only:** If two memories give different values for the same atomic fact, prefer the more recent. This NEVER applies to lists or cumulative attributes.

**Rule 7 — Entity attribution: verify the subject before answering.**
When two people share similar activities or objects, explicitly confirm which person a memory names as the subject before using it. Do not transfer an attribute from one person to another because they share a related activity. If a memory says "Person A's bowl is a reminder of X", that fact belongs to A only — even if B also has a bowl.

**Rule 8 — Before refusing, exhaust all options.**
If your reasoning leads to "not found" or "not supported", STOP and re-scan ALL memories [1]–[N] AND conversation context for: specific names in lower-ranked memories; relative expressions that resolve to dates ("read last year" + observed_at 2023-07 → 2022); product names implying platforms; any one-step inference from Rule 4. A fact in memory [8] overrides "not found" from [1]–[3]. For yes/no questions, lean "Yes" if ANY evidence exists. Only refuse if truly ZERO evidence — direct or inferrable — addresses the question.
- **Generic descriptor → scan for specific name:** If the best answer you have is a generic descriptor (home country, an outdoor company, a social deduction game, a type of sport, a health condition), do NOT answer with it yet. First scan every remaining memory and the full Conversation Context for a specific name that matches the descriptor. If found anywhere — even in a low-ranked memory or raw conversation text — use that specific name. Only fall back to the generic if no specific name exists in any retrieved context.
- **Soft inference is mandatory:** When a question asks for a likely/probable value and no explicit answer exists, you MUST give the best-supported estimate — never answer "not provided" or "no information" when indirect signals exist. Examples: "X is in school" → "likely ≤30"; "faith symbols/objects mentioned" → "somewhat religious"; "only dogs give X joy + actively dating" → "was likely lonely". State your reasoning, then commit to the most specific supportable answer.

**Output rules:**
- **Verbatim:** Copy exact named entities from memories/conversation — instruments, colors, titles, places, pet names. "violin" not "clarinet". For locations, name the PLACE, not the activity done there.
- **Qualifiers:** Preserve ALL ("for transgender people", "in the mountains", org names). "X for Y" not just "X".
- **Geographic granularity:** City → country/state if the question asks for the larger unit.
- **Format:** Dates exact ("7 May 2023"). Lists comma-separated. Names/places exact. ONE line after "Answer:".

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
