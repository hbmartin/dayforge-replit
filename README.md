# Product Spec (PRD): Structured Journal — “Notebook-first, protocol-when-you-want-it”

## 1) Summary

A private journal that defaults to **frictionless capture** (no “coachy” interruptions), with **optional guided sessions** that follow evidence-based protocols and end in **useful outputs** (plans, insights, to-dos). The system uses lightweight routing, careful “dosing,” and guardrails to avoid common journaling failure modes (rumination, persistent distress).

A "Notebook-First" application that uses an LLM not as a chatbot, but as a **Protocol Runner**. The system acts as a triage nurse and clinical guide, routing unstructured user input into evidence-based cognitive frameworks (CBT, Implementation Intentions, Gratitude) to produce tangible artifacts (plans, insights, offloaded loops) rather than just text entries.

Journaling works best when it's structured toward cognitive processing and action—not when it's an empty page. Different techniques have meaningfully different outcomes (and different risks). An LLM is uniquely positioned to act as an **active facilitator** rather than a passive repository.

**One-liner:** A notebook that listens—then helps you **process and act** when you choose.

Alternative one liner: A private notebook that's frictionless for quick capture, plus optional guided sessions that translate writing into *meaning-making* and *action plans*—the parts that drive most of the measurable benefit.

------

## 2) Problem & Why Now

### Problems we’re solving

1. **Blank page problem:** People don’t know what to write; free-form often stalls.
2. **The user is always in control:** They can use the outputs actively or passively.
3. **Journaling that doesn’t change anything:** Venting without cognitive processing or action planning has limited benefit.
4. **Adherence drops:** Users quit if it’s too time-consuming or repetitive.
5. **Backfire risk:** Unstructured “processing” can become rumination; some content needs extra care.
6. **Memory bloat / creepiness:** If “AI remembers,” it must be transparent and user-controlled.
7. **Outputs, Not Just Inputs:** Every session must yield an artifact (e.g., an "If-Then" plan, a "To-Do" list, a "Balanced Thought").
8. **Transparent Memory:** The user should feel the system "learning" them via explicit entity tracking (Zep) and pattern recognition (Mem0).

### Product thesis

Journaling works best when it’s **structured toward cognitive processing and action**, and different protocols yield different outcomes and risks. The product should **route** users into the right “session type,” run it like a **protocol**, and always produce a small, concrete artifact.

------

## 3) Target Users & Use Cases

### Primary target (MVP)

**Busy professionals / builders** who want:

- better follow-through (executive function),
- better daily reflection/learning,
- better sleep via cognitive offloading,
- improved wellbeing without “therapy vibes.”

### Secondary (V1)

- Anxiety/stress “stuckness” (structured thought records)
- Creativity/direction (best-possible-self, future narrative)
- Routine builders (morning/evening rhythms)

------

## 4) Goals, Non-Goals, Success Metrics

### Goals

- Make journaling **easy to start** (60 seconds) and **easy to sustain** (lightweight cadence).
- Deliver tangible outcomes: “I leave with a plan / insight / list.”
- Provide “memory” that feels **helpful, not invasive**.
- Reduce risk of rumination via **mode switching + check-ins**.

### Non-goals

- Not a therapist, not clinical treatment, not crisis support.
- Not “always-on coaching.” The default is notebook-first.

### Success metrics

**Activation**

- % create first entry
- % complete first guided session
- Time-to-first-artifact (plan/todo/insight)

**Outcome proxies**

- Completion checks on plans (“did it happen?”)
- Sleep workflow usage before bed

##### Quality

- Entries with "meaning-making" language (because/realize/understand)
- Gratitude variety (not repeating same items)
- Thought record completion rate
- Time in session (engagement without rumination)

------

## 5) Product Principles

1. **Notebook-first:** AI doesn’t interrupt free writing.
2. **Protocol runner, not a diarist:** guided sessions follow a script with evidence-based structures and a clear end.
3. **Artifacts over advice:** every guided session ends with something actionable or summarizable,  something concrete (a plan, an insight, a next step).
4. **Transparent memory:** what’s remembered is visible and controllable.
5. **Guardrails by design:** detect loops, check mood, switch modes, timebox.

------

## 6) Core Experience & UX

## 6.1 Key Screens

### Notebook (home)

Appears as a blank page at first. Tan colors evocative of an old leather bound book. Faint line separators.

 After 5 seconds a question (chosen by router) appears to "melt" onto the page (like a Harry Potter spell book)

The user can dismiss the prompt (by pressing escape or delete)

When the user has stopped typing for several seconds another question appears from router.

### Sessions (Capture-first)

- Big capture box
- Choose e.g. Plan / Reflect / Lift / Sleep / Unpack / Clarity
- Suggested session chip (optional, based on time-of-day + settings)

### Timeline

- Session and notebook entries
- Entries with: title, tags, entities, optional summary
- Search & filters: tags, people, projects, mood, mode

### Plans / Habits

- Accepted “if–then” plans (one-shot or recurring)
- Optional “Did it happen?” quick check

### Reviews (Weekly)

- Themes, wins, recurring obstacles, suggested experiments (opt-in)
- **Mood/energy trends**: "Your average morning energy this month vs. last"
- **Topic frequency**: "You mentioned [X] 5 times this week"
- **Open loops**: "These worries from last week—did any resolve?"
- **Pattern insights**: "I've noticed you tend to feel better after [activity]"
- **Gratitude themes**: "Most of your gratitudes this month involved [people/experiences]"

### Memory (Transparency & Controls)

- People / Projects / Themes / Goals
- Per-entity toggle: “Don’t remember this”
- Clear “forget” controls

------

## 6.2 Onboarding (lightweight, non-clinical)

**8 questions** (fast, skippable):

1. Primary outcomes: wellbeing / performance / focus / creativity / relationships (multi-select)
2. Writing style: quick notes / guided / mix
3. Nudges: morning / midday / evening / none
4. Coachiness default: Silent / Light / Active
5. Time budget: 1 min / 3 min / 10–15 / 20
6. Desired outputs: if–then plans / next-steps / none
7. Topics handled carefully (optional)
8. Memory: remember names/projects? weekly digests? (yes/no)

------

## 6.3 Daily Rhythm (Opt-in “Open & Close”)

- ### Morning: **Prime & Plan** (Focus + Affect)

  - **Goal:** Set intention and boost positive affect (using variety to avoid adaptation).
  - **Protocol:**
    1. **Gratitude (The "Appreciation Hunter"):** AI queries *Mem0* for past gratitude to ensure novelty. Prompts shift daily (e.g., Sensory focus vs. Relational focus).
       - *Probe:* "Why did that happen?" (Forces causal attribution).
    2. **Implementation Intention (The "Plan"):**
       - *Prompt:* "What is the one win you need today?"
       - *Prompt:* "What usually derails this?"
       - *Output Artifact:* **If-Then Plan** ("If [trigger] happens, then I will [action]").
    3. **Create** "Design your future"
       1. Best Possible Self (optimism/positive affect)
       2. 1×/week

  ### B. Midday: **Capture & Triage** (Executive Function)

  - **Goal:** Quick capture of open loops or acute stress.
  - **Interaction:** "Notebook-first" interface
  - **The Router (Hidden Layer):**
    - *Input:* "I'm freaking out about the board meeting."
    - *Classification:* **High Anxiety / Cognitive Distortion**.
    - *Action:* Suggest **"The Socratic Guide"** (CBT Mode).

  ### C. Evening: **Reflect & Offload** (Cognitive Offloading)

  - **Goal:** Reduce sleep onset latency and close "open loops."
  - **Protocol:**
    1. **The "Neural Unpack":** User dumps worries/tasks.
    2. **Structuring:** AI converts dump into a JSON-structured **To-Do List** for tomorrow.
    3. **Loop Closure:** AI checks *Zep* indices: "Last Tuesday you were worried about Project X. How did that resolve?" (Reconciles worry vs. reality).

------

## 7) Guided Sessions (Modes)



### Mode A: **Plan** (Implementation Intentions) — 2–4 min

**Goal:** follow-through.
Flow:

1. outcome
2. derailers/obstacle
3. reliable trigger moment
4. draft 1–3 if–then plans + backup (“friction fix”)

**Artifact:** if–then statements, optionally calendar-ready wording.

------

### Mode B: **Reflect** (Work Reflection) — 10–15 min (plus mini 3–5 min)

**Goal:** learning/performance.
Flow:

- what mattered
- what worked
- what didn’t
- lesson
- experiment tomorrow → converts into a Plan

**Artifact:** lesson + experiment + if–then plan.

------

### Mode C: **Sleep** (Offload) — 5 min

**Goal:** reduce bedtime mental load via specificity.
Flow:

- messy brain dump
- convert into concrete to-do list for next 24–48h
- confirm: “stored; you don’t need to hold it”

**Artifact:** prioritized to-do list.

------

### Mode D: **Lift** (Gratitude + Values Reset) — 90s–5 min

**Goal:** positive affect, stress buffering.
Submodes:

- Gratitude: 3–5 items, prompt variety + “why” probe (avoid rote lists)
- Values reset: short values writing for stressful days

**Artifact:** gratitude list (with “why”), or values paragraph.

------

### Mode E: **Clarity** / Untangle (Conversational Thought Record) — 5–12 min

**Goal:** reduce “stuckness” via structured questioning (no therapy framing).
Flow (7-column, unnamed):

1. situation (facts)
2. emotion + intensity (0–100)
3. automatic thought
4. evidence for
5. evidence against
6. balanced thought
7. re-rate intensity

**Artifact:** balanced thought + “next step” (optional Plan).

------

### Mode F: **Unpack** (Expressive Writing) — 15–20 min, timeboxed

**Goal:** meaning-making (not venting).
Flow:

- situation summary
- affect labeling
- meaning-making prompts (reframe/insight)
- end with mood check: worse/same/better

**Artifact:** one reframe/insight + optional narrative summary (user-approved).

**Guardrails:** timebox, no escalation into “treatment,” mode switch if looping.

------

### Mode G: Create (Best Possible Self) — 15–20 min

### 

```
Step 1: "Imagine your life 1–5 years from now, where everything has gone as well as it possibly could. What does that look like?"
Step 2: 15 min writing (AI does not interrupt)
Step 3: "Close your eyes for 2 minutes and visualize one scene from that future."
Step 4: "What's one thing you could do this week that moves toward that vision?"
```

**Output**: Vision narrative + 1 concrete next step

## 8) Routing (“Choose the right session”)

Users can explicitly choose a mode, or the system can suggest based on:

- Time of day (morning → Plan, evening → Reflect)
- Detected emotional state from free-form entry
- User's stated goal during onboarding
- Explicit triggers ("I can't sleep" → Sleep/Offload variant of Plan)

### A) User-driven (explicit choice)

Buttons: Plan / Reflect / Sleep / Lift / Clarity / Unpack

### B) “smart router” (Hidden layer)

Ask 3–6 questions max, e.g.:

- “What do you want right now?” (sleep / calm / plan / reflect / process / boost)
- “Time budget?” (60s/3m/15m)
- “Do you want outputs?” (plan/list/none)

Route to mode + variant length.

These are the "Specialist" modes the Router invokes. 

| **Mode Name** | **Trigger**             | **Evidence Basis**                                | **Protocol Steps**                                           | **Output Artifact**                             |
| ------------- | ----------------------- | ------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| **Plan**      | Morning / High Workload | Implementation Intentions ($d \approx 0.65$)      | Goal $\to$ Obstacle $\to$ Trigger $\to$ Plan                 | **If-Then Statement** (Saved to "Strategy" tab) |
| **Untangle**  | Anxiety / "Stuck"       | CBT Thought Records                               | Situation $\to$ Auto-Thought $\to$ Evidence For/Against $\to$ Reframe | **Balanced Thought Record**                     |
| **Offload**   | Bedtime / Overwhelm     | Cognitive Offloading ($d \approx 0.63$ for sleep) | Brain Dump $\to$ Extraction $\to$ Confirm "Safe"             | **Next-Day Action List**                        |
| **Unpack**    | Deep Stress / Sunday    | Expressive Writing (Pennebaker)                   | Affect Labeling $\to$ Meaning Making $\to$ Cooldown          | **Insight Summary** (No critique/advice)        |
| **Lift**      | Low Mood                | Positive Affect / Gratitude                       | Novelty Scan $\to$ Causal Elaboration                        | **Gratitude Log**                               |

------

## 9) Safety & Guardrails

### Built-in checks

- **Post-session check:** worse / same / better
- **Rumination detection:** repeated topic + no new insight + mood not improving over N sessions → switch tactic:
  - suggest Plan/Lift/Clarity
  - or suggest stopping for today

### Content boundaries

- Clear positioning: “not a therapist”
- For severe trauma/PTSD-like content or crisis indicators:
  - stop protocol, encourage professional support / crisis resources (implementation detail)
- No medical claims; no diagnosis.

### “Dip management”

- *UI:* Expressive writing sessions ("Unpack") include a "Cooldown" phase (2 mins of unrelated, grounding questions) to prevent leaving the user in a raw state.
- Normalize short-term heaviness after processing
- **Evening gratitude as structural guarantee**: Processing never ends the session. Gratitude does.

### Post-Session Check

After any Unpack session:

```
AI: How are you feeling now compared to when we started? Worse / Same / Better?
```

Short-term worse is normal for expressive writing. Persistent worsening (2+ sessions) is a flag → route away from Unpack.

------

## 10) Data Model & Storage

### Dual-layer entry schema

Each entry stores:

- **Raw content** (immutable)
- **Mode**
- **Structured metadata** (queryable): emotion, sentiment, tags, entities, topic
- **Artifacts** (mode outputs): todo list, if–then plans, balanced thought, etc.

Suggested object (conceptual):

- Entry(id, timestamp, mode, raw_content, structured_metadata, artifacts)

------

## 11) Memory Architecture (Two-tier)

### Tier 1: Episodic/Entity Memory (Zep-style)

- **Function:** Stores raw entries / transcripts and temporal entity graphs.
- **Use Case:** "Context Injection." When the user mentions "Fanxi," Zep retrieves the last 3 interactions involving "Fanxi" and "Travel."
- **Mechanism:** Recency-weighted semantic search.

- timestamped sessions/entries
- entity extraction (people/projects/topics)
- temporal retrieval (recent + relevant)
- **Open loops**: forward-looking statements that need follow-up (worries, goals, anticipated events)

**Powers**:

- "What happened last week with Project Atlas?"
- "When did I last mention burnout symptoms?"
- Context injection that's time-aware (recent vs. stale)

### Tier 2: Compressed Long-term Memory (Mem0-style)

- **Function:** Stores compressed, long-term facts and patterns.

- Distilled patterns: "User tends to catastrophize about work deadlines but outcomes are usually fine"

- Long-term facts: "User has a difficult relationship with their mother"

- **Use Case:** "Personalization."

  - *Fact:* "User has a tendency to catastrophize about deadlines."
  - *Application:* When the user starts a **Plan** session for a deadline, the system prompt injects: *System Note: User tends to overestimate risk. Probe gently for realistic outcomes.*

  

- weekly/monthly digest summaries

- Stable preferences: writing style, nudge timing, coaching intensity

- Cognitive tendencies: "User's automatic thoughts about work skew toward worst-case scenarios"

**Powers**:

- Personalization without dragging huge transcripts into every prompt
- Pattern coaching that feels earned (because it's aggregated)
- Thought record calibration (know when to probe harder on "evidence against")

### Typical Retrieval pattern

- Simple journaling: retrieve nothing unless asked
- Guided sessions: retrieve only relevant entities/goals + last 1–3 related entries
- Weekly review: broader pattern retrieval
- Thought record: optionally fetch counterexamples from memory for “evidence against”

### User control

- Memory screen shows what’s stored
- per-entity “don’t remember”
- delete/forget actions

### Open Loop Tracking

**Critical feature**. Any time the user expresses worry about a future event or sets a goal:

1. Flag it with an expected resolution date (explicit or inferred)
2. Surface it later: "You thought X would happen—what actually happened?"

This is a quiet cognitive restructuring tool. Most anxious predictions never get tested.

### Memory Write Policy

Every entry produces three artifacts:

1. **Raw entry** (private, immutable)
2. **Structured metadata** (entities/tags/mood/actions) → Zep
3. **Periodic digest summaries** (weekly) → Mem0-store

------

## 12) Technical Architecture (High Level)

### A. Orchestration model: Router + Specialists

- **Router** classifies intent/mode and selects a specialist prompt/script.
- **Specialist** runs a strict protocol:
  - question sequence
  - allowed follow-ups
  - output schema
  - stop conditions

### B. “Journal OS primitives” (tool interface)

- create_entry(raw_text, mode, timestamp, metadata)
- finalize_entry(entry_id, summary/tags/entities/mood/artifacts)
- extract_entities(entry_id)
- create_if_then_plan(goal, trigger, action, backup)
- write_open_loop(item, expected_resolution_date)
- write_weekly_summary(summary)
- risk_check(entry_id) → rumination/distress flags

### C. Background jobs

- entity extraction + topic tagging
- weekly digest summarization
- open-loop follow-up scheduling

### D. Prompt Engineering Strategy

- Two-layer system: stable policy + mode-specific protocols.

  ### Layer 1: System Policy (Stable)

  ```
  You are a guided journal assistant. Your core principles:
  
  1. NOTEBOOK-FIRST: Don't coach unless invited. If user writes freely, acknowledge briefly ("I've saved that.") or remain silent. Never give unsolicited advice.
  
  2. PROTOCOL-DRIVEN: When in guided mode, follow the session protocol strictly. Ask one question at a time. Wait for response before proceeding.
  
  3. MEANING-MAKING: In expressive sessions, push for "because/realize/understand" language—this is tied to better outcomes.
  
  4. DOSING: Don't over-prescribe gratitude daily (adaptation risk). Default 2–3×/week.
  
  5. SAFETY: Expressive writing can temporarily worsen mood. Always check in. Switch modes if repetitive/ruminative.
  
  6. OUTPUTS: Every guided session ends with a concrete artifact (plan, insight, lesson).
  ```

  ### Layer 2: Mode Prompts (Per Session Type)

  Each mode prompt includes:

  - Required questions (in order)
  - Allowed follow-ups
  - Output schema
  - Stop conditions (e.g., "user wants freewrite; stop prompting")
  - Guardrails specific to that mode

  ### Router (Intent Classification)

  Before generating a response, classify user intent:

  ```
  Classify the user's intent into one of the following MODES:
  
  1. PASSIVE: User wants to vent, record, or write freely. 
     Action: Acknowledge briefly or remain silent. DO NOT give advice.
  
  2. PLAN: User wants to commit to action or is stressed about tasks.
     Action: Activate implementation intention protocol.
  
  3. REFLECT: User is reviewing their day or a recent experience.
     Action: Activate reflection protocol.
  
  4. LIFT: User is in morning routine or wants mood boost.
     Action: Activate gratitude protocol.
  
  5. UNPACK: User expresses anxiety, cognitive distortion, or wants to process something difficult.
     Action: Activate thought record protocol.
  
  6. CREATE: User wants to envision their future or set direction.
     Action: Activate best possible self protocol.
  
  Input: "I just can't get my brain to shut off about the launch tomorrow."
  Output: PLAN (cognitive offloading variant)
  ```


------

## 13) MVP Scope

### 

- Capture + Notebook timeline
- Save + organize
- Guided sessions: **Plan, Reflect, Sleep, Lift (basic gratitude)**
- Memory tier 1 (entities + recent retrieval) + basic controls
- Post-session check + basic rumination detection

- Clarity (thought record)
- Unpack (expressive writing) with stronger guardrails
- Weekly Review digest + pattern surfacing
- Open-loop follow-ups (“you worried about X—how did it go?”)
- Richer memory tier 2 (compressed summaries)
