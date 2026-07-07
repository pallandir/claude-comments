---
name: northstar-design-score
description: 'Score a web page screenshot for fitness to its own purpose (not an absolute award-site bar) and submit the Northstar ui/ux/coherence rating (0-100). Invoke when list_rating_requests returns pending items, then call submit_rating with the result.'
license: MIT
metadata:
  author: pallandir
  version: "2.0.0"
  attribution: 'Scoring rubric adapted from wondelai-top-design by Wondel.ai (MIT). See THIRD_PARTY_LICENSES.md.'
---

# Northstar Design Score

Evaluate a page screenshot against a rubric adapted from award-site craft criteria, but scored **relative to what the page is trying to be**, and produce Northstar's three rating dimensions (ui, ux, coherence) plus a composite score, all on a 0–100 integer scale.

## When to use

This skill is designed to run inside a **disposable sub-agent** spawned by the Northstar watch-mode session. The parent session delegates each pending rating to a fresh sub-agent using the `ratingSubAgentPrompt` returned by `bind_session`, so scoring stays out of the main conversation. The sub-agent calls `list_rating_requests`, applies this rubric, calls `submit_rating`, then exits.

If invoked directly (not via a sub-agent), apply the same procedure: when `list_rating_requests` returns a pending rating request, load the screenshot at the path it reports, evaluate it against the rubric below, then call `submit_rating`.

## Step 1: infer the page's archetype and purpose

Before scoring anything, look at the screenshot and decide what kind of page this is and what it is optimizing for. This determines what "good" means for every dimension below. Common archetypes:

- **Dashboard / internal tool / web-app** — optimizes for clarity, density, speed of scanning, low cognitive load. Restraint is a feature, not a gap.
- **Marketing / landing page** — optimizes for persuasion, emotional impact, brand memorability. Rewards visual drama and motion.
- **Docs / content / reading** — optimizes for legibility, hierarchy, scan-ability. Rewards typographic craft, penalizes decoration that slows reading.
- **E-commerce / catalog** — optimizes for trust, product clarity, frictionless action. Rewards clean craft over spectacle.
- **Portfolio / agency / brand showcase** — optimizes for impression, differentiation, cinematic craft. This is the one archetype where the full award-site bar applies directly.

State the inferred archetype in one clause inside `notes` (e.g. "utility dashboard — judged on clarity, not spectacle").

## Step 2: score each sub-dimension 0–100, judged against that purpose

The bands below describe the *craft ceiling* for each dimension (what 76–100 looks like at the extreme, portfolio/agency end). For every other archetype, judge the dimension by **how well it serves the page's own purpose**, not by how close it comes to that cinematic ceiling. A restrained, high-clarity dashboard with no animation and system fonts used well is not a 0–25 — it can legitimately score 70+ if the restraint is the right choice for the job. Reserve low scores for craft that actively undermines the page's own goals (inconsistent spacing, illegible contrast, default browser styling left un-styled by accident, hover states missing where the UI implies interactivity), not for the mere absence of drama the page never needed.

### TYPOGRAPHY

| Ceiling (portfolio/agency) | What to reward at any archetype |
|---|---|
| 76–100: Typography IS the design — custom/variable fonts, type as architecture | Clear, deliberate hierarchy suited to the content; legible at the sizes actually used; scale/weight choices communicate structure. Penalize: inconsistent or arbitrary sizing, poor legibility, unstyled browser defaults left by accident. |

### VISUAL COMPOSITION

| Ceiling (portfolio/agency) | What to reward at any archetype |
|---|---|
| 76–100: Magnetic compositions, unexpected scale shifts | Layout serves the content's structure; spacing rhythm is consistent and intentional; alignment is clean. A dense, grid-aligned dashboard scores well here for doing its job cleanly. Penalize: cramped or inconsistent spacing, misalignment, visual clutter that isn't information-dense on purpose. |

### MOTION & INTERACTION

| Ceiling (portfolio/agency) | What to reward at any archetype |
|---|---|
| 76–100: Motion tells stories, perfectly timed choreography | Motion (or its deliberate absence) matches the page's needs: a dashboard with fast, unobtrusive transitions (or none) scores well; a landing page with no motion where drama would help scores lower. Penalize: janky/default transitions, motion that gets in the way of task completion, or a marketing page with zero attempt at engagement. |

### COLOR & ATMOSPHERE

| Ceiling (portfolio/agency) | What to reward at any archetype |
|---|---|
| 76–100: Colors feel invented for this specific project | A coherent, purposeful palette appropriate to the context (a utility UI's restrained neutrals + one accent is not a gap). Penalize: random/clashing colors, poor contrast, or a palette that reads as an afterthought rather than a decision. |

### DETAILS & CRAFT

| Ceiling (portfolio/agency) | What to reward at any archetype |
|---|---|
| 76–100: Every micro-detail deliberate — focus states, loading, empty states | Interactive elements have appropriate states (hover/focus/active) where the UI implies interactivity; empty/loading/error states are handled, not blank. Penalize: default cursors on custom controls, missing focus indicators, obviously unhandled states. |

## Mapping to Northstar dimensions

```
ui        = round(Typography × 0.4 + Composition × 0.4 + Color × 0.2)
ux        = round(Motion × 0.6 + Details × 0.4)
coherence = holistic 0–100 assessment of cross-dimension consistency and visual unity
score     = round((ui + ux + coherence) / 3)
```

`coherence` is a separate holistic read: how unified the design feels across typography, motion, color, and craft as a whole, given the page's own purpose. A design can score high on individual dimensions but low on coherence when the parts feel disconnected or the visual language contradicts the page's stated intent (e.g. a data-dense dashboard using decorative display type that fights legibility).

## Operating procedure

1. Receive a pending rating request id and the absolute path to its screenshot from `list_rating_requests`.
2. Examine the screenshot and infer the page's archetype/purpose (Step 1 above).
3. Score each sub-dimension 0–100 using the rubric above, judged against that purpose (Step 2).
4. Compute ui, ux, and coherence from the mapping formulas.
5. Write one sentence of notes identifying the inferred archetype plus the page's strongest quality or biggest gap *relative to that archetype*.
6. Write one or two sentences of pure, actionable advice per sub-dimension. Each `advice` must be an imperative recommendation that starts with an action verb ("Standardize…", "Add…", "Tighten…") and states only what to change and the benefit, framed for the page's actual purpose (don't advise cinematic motion on a dashboard). Do NOT describe, praise, or restate the current state of the page — the score already carries that assessment. Never write "X is clear/good/appropriate; do Y"; write only "Do Y so that Z."
7. Call `submit_rating` with all fields, including `sections` — one entry per sub-dimension in this order:
   - `{ key: "typography", label: "Typography", score: <typography>, advice: "<...>" }`
   - `{ key: "composition", label: "Composition", score: <composition>, advice: "<...>" }`
   - `{ key: "motion", label: "Motion & Interaction", score: <motion>, advice: "<...>" }`
   - `{ key: "color", label: "Color & Atmosphere", score: <color>, advice: "<...>" }`
   - `{ key: "details", label: "Details & Craft", score: <details>, advice: "<...>" }`
