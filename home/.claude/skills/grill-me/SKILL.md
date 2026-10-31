---
name: grill-me
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

## Domain language

Read the repository's `glossary.md` before the interview, if it exists. Challenge terms that conflict with it as soon as they appear. For vague or overloaded language, propose one precise canonical term and use concrete edge cases to test its boundaries and relationships. Check claims about existing behavior against the code; surface contradictions so Herb can settle the intended meaning.

As soon as Herb settles a term, update `glossary.md` in that round. Create it lazily when the first term is settled. Record only the term, its definition, and any disallowed synonyms needed to distinguish it from nearby concepts. Keep implementation details, specifications, decisions, and interview notes elsewhere. Use the filename `glossary.md`, never `GLOSSARY.md` or `CONTEXT.md`.

Offer a decision record only when all three hold: the choice is hard to reverse, a future reader would find it surprising without context, and it results from a real trade-off between genuine alternatives. Otherwise skip it. Follow the repository's decision-record conventions when Herb accepts the offer.

Capturing a settled definition is part of this interview; implementation still waits for the shared-understanding confirmation below.

## Interview rounds

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.

Format a round like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed. Do not act on it until the user confirms you have reached a shared understanding.

Domain-language guidance adapted from Matt Pocock's [domain-modeling skill](https://github.com/mattpocock/skills/blob/main/skills/engineering/domain-modeling/SKILL.md), under the [MIT license](../retro/LICENSE).
