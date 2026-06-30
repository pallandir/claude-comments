---
name: redline-design-score
description: 'Score a web page screenshot using an Awwwards-style rubric and submit the Redline ui/ux/coherence rating (0-100). Invoke when list_rating_requests returns pending items, then call submit_rating with the result.'
license: MIT
metadata:
  author: pallandir
  version: "1.0.0"
  attribution: 'Scoring rubric adapted from wondelai-top-design by Wondel.ai (MIT). See THIRD_PARTY_LICENSES.md.'
---

# Redline Design Score

Evaluate a page screenshot using an Awwwards-inspired rubric and produce Redline's three rating dimensions (ui, ux, coherence) plus a composite score, all on a 0–100 integer scale.

## When to use

When `list_rating_requests` returns a pending rating request, load the screenshot at the path it reports, evaluate it against the rubric below, then call `submit_rating`.

## Sub-dimension rubric (each scored 0–100)

Score each sub-dimension independently before deriving the Redline dimensions.

### TYPOGRAPHY

| Range | Criteria |
|-------|----------|
| 0–25 | System fonts, uniform scale, default tracking |
| 26–50 | Premium fonts, some scale contrast, basic hierarchy |
| 51–75 | Dramatic scale contrast (10:1+), tight tracking on display, optical alignment |
| 76–100 | Typography IS the design — gasping moments, custom/variable fonts, type as architecture |

### VISUAL COMPOSITION

| Range | Criteria |
|-------|----------|
| 0–25 | Centered everything, equal spacing, rigid grid, no visual tension |
| 26–50 | Some asymmetry, decent spacing rhythm, basic depth |
| 51–75 | Intentional grid breaks, layered elements, strong negative space |
| 76–100 | Magnetic compositions, unexpected scale shifts, elements that breathe and surprise |

### MOTION & INTERACTION

| Range | Criteria |
|-------|----------|
| 0–25 | No animation or default/linear motion |
| 26–50 | Basic transitions, some scroll effects |
| 51–75 | Custom easing, orchestrated reveals, purposeful parallax |
| 76–100 | Motion tells stories, perfectly timed choreography, scroll feels invented |

### COLOR & ATMOSPHERE

| Range | Criteria |
|-------|----------|
| 0–25 | Random colors, pure black/white, no mood |
| 26–50 | Cohesive palette, some atmosphere |
| 51–75 | Colors feel owned by the brand, contextual shifts, intentional contrast |
| 76–100 | Colors feel invented for this specific project, atmosphere you can feel |

### DETAILS & CRAFT

| Range | Criteria |
|-------|----------|
| 0–25 | Default cursors, no hover states, generic everything |
| 26–50 | Basic hover states, some custom elements |
| 51–75 | Considered hover states, branded selection colors, styled focus indicators |
| 76–100 | Every micro-detail deliberate — focus states, loading, empty states, scroll indicators |

## Mapping to Redline dimensions

```
ui        = round(Typography × 0.4 + Composition × 0.4 + Color × 0.2)
ux        = round(Motion × 0.6 + Details × 0.4)
coherence = holistic 0–100 assessment of cross-dimension consistency and visual unity
score     = round((ui + ux + coherence) / 3)
```

`coherence` is a separate holistic read: how unified the design feels across typography, motion, color, and craft as a whole. A design can score high on individual dimensions but low on coherence when the parts feel disconnected.

## Operating procedure

1. Receive a pending rating request id and the absolute path to its screenshot from `list_rating_requests`.
2. Examine the screenshot.
3. Score each sub-dimension 0–100 using the rubric above.
4. Compute ui, ux, and coherence from the mapping formulas.
5. Write one sentence of notes identifying the page's strongest quality or biggest gap.
6. Call `submit_rating({ id, score, ui, ux, coherence, notes })`.
