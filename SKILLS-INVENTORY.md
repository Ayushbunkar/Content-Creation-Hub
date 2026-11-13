# Skills Inventory & Security Audit

This inventory lists and reviews the skills installed on the system, their purposes, source locations, and security evaluations.

---

## 1. Project-Level Remotion Skills (`.agents/skills/` & `.claude/skills/`)

These skills are official, local, open-source best practice guides and tool references for the Remotion video engine.

| Skill | Path | Purpose | Security Rating |
| :--- | :--- | :--- | :--- |
| **remotion-best-practices** | `.agents/skills/remotion-best-practices/` | Router and master index for Remotion workflows | Safe (Verified) |
| **remotion-captions** | `.agents/skills/remotion-captions/` | Transcribing, displaying, and styling captions | Safe (Verified) |
| **remotion-create** | `.agents/skills/remotion-create/` | Creating new Remotion compositions and layouts | Safe (Verified) |
| **remotion-docs** | `.agents/skills/remotion-docs/` | Search Remotion official documentation | Safe (Verified) |
| **remotion-interactivity** | `.agents/skills/remotion-interactivity/` | Timeline structures, multi-track sequencing | Safe (Verified) |
| **remotion-license** | `.agents/skills/remotion-license/` | Remotion licensing information and FAQs | Safe (Verified) |
| **remotion-maps** | `.agents/skills/remotion-maps/` | Map explainer architectures, geo-prep, techniques | Safe (Verified) |
| **remotion-markup** | `.agents/skills/remotion-markup/` | Audio, canvas, color correction, transitions | Safe (Verified) |
| **remotion-multimedia** | `.agents/skills/remotion-multimedia/` | Querying audio/video durations and dimensions | Safe (Verified) |
| **remotion-render** | `.agents/skills/remotion-render/` | Exporting videos, transparent videos, CLI flags | Safe (Verified) |
| **remotion-saas** | `.agents/skills/remotion-saas/` | Remotion Player and web integrations | Safe (Verified) |
| **remotion-studio** | `.agents/skills/remotion-studio/` | Live previewing and debugging compositions | Safe (Verified) |
| **remotion-upgrade** | `.agents/skills/remotion-upgrade/` | Upgrading packages safely | Safe (Verified) |

---

## 2. Global Skills (`C:\Users\Rupesh\.agents\skills\`)

| Skill | Purpose | Security Rating & Analysis |
| :--- | :--- | :--- |
| **find-skills** | Discover skills on github / local | Safe |
| **media-use** | Asset resolution and licensing check | Safe |
| **remotion-to-hyperframes**| Convert Remotion projects to HyperFrames | Low Risk (Not needed for local pipeline) |
| **slideshow** | Simple slideshow generator | Safe |
| **style-sampling** | Sample aesthetic parameters | Safe |
| **reverse-any-video** | Rebuild video via external APIs | **CRITICAL RISK / QUARANTINED** |

### Detailed Review: `reverse-any-video` (Critical Risk)
- **Telemetry Beacon**: Contains instructions to execute `npx hyperframes events --skill=reverse-any-video` upon invocation to transmit machine/account telemetry.
- **Paid / Cloud API Dependencies**: Forces reliance on HeyGen (paid actor avatar reshooting) and HyperFrames Pro subscription billing (`npx hyperframes reverse start`, `billing subscribe`).
- **Policy Compliance**: Directly violates the requirement for a zero-cost, local-only production pipeline.
- **Action**: This skill has been flagged and is explicitly excluded from the production workflow.


---

## 3. Open-Source Repository Evaluation (Caption Studio)

| Repository | Focus & Architecture | License | Evaluation & Integration Takeaways |
| :--- | :--- | :--- | :--- |
| **`francozanardi/tscaps`** | Browser-based video editor for animated short-form captions | **AGPL-3.0** | **Architectural Insight Reused, Zero Code Copied**: Evaluated their browser-native CSS keyframe animation techniques (`@keyframes wordPop`, active word coloring) and streaming upload design. Due to AGPL-3.0 copyleft obligations, no proprietary or licensed code was incorporated. Our implementation is written cleanly from scratch using native React/Tailwind and FFmpeg. |
| **`vorniches/cutstorm`** | Browser video editor with local Whisper transcription | **MIT** | **Workflow Insight**: Confirmed the efficiency of local FFmpeg audio extraction prior to Whisper inference and validated aspect-ratio cropping patterns for 9:16 Shorts/Reels. |
| **`hikashop-nicolas/subedit`** | Standalone browser subtitle and transcript editor | **MIT / LGPL** | **Editor Mechanics**: Evaluated interactive click-to-seek, sentence split/merge logic, and synchronized playback tracking. All transcript editing logic in our studio is implemented natively with React state and undo/redo stacks. |
