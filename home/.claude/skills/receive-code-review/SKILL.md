---
name: receive-code-review
description: Use before implementing code-review feedback. Verify each suggestion against the codebase, clarify ambiguity, and push back when evidence does not support it.
---

# Receive code review

Treat review comments as technical claims to evaluate, not instructions to accept automatically.

## Process

1. Read all feedback before acting.
2. Restate the technical requirement when it is not obvious.
3. Verify the claim against the code, tests, requirements, platform support, and prior decisions.
4. Ask about any ambiguity that could change the implementation. Do not implement an interdependent subset while the rest remains unclear.
5. Decide whether the suggestion is correct and in scope.
6. Implement accepted items one at a time and verify each change.
7. Explain rejected items with specific evidence.

Prioritize security and broken behavior, then simple fixes, then larger refactors.

## Evaluation

Push back when a suggestion:

- breaks required behavior or supported platforms;
- conflicts with a documented architectural decision;
- assumes context the reviewer did not have;
- adds unused capability or speculative complexity; or
- is technically incorrect for this codebase.

Search for actual use before accepting a request to “implement properly.” Remove unused behavior or ask about the need instead of expanding it by default.

If evidence is unavailable, state what would resolve the question and ask before making a risky assumption. Herb’s explicit decisions outrank external review feedback.

## Communication

Use factual acknowledgments such as “Fixed: the parser now rejects empty input.” Avoid praise, gratitude, ritual agreement, defensiveness, and long apologies.

If your initial pushback was wrong, state what evidence changed your conclusion and correct the work.

Reply to GitHub inline comments in their threads, not as top-level PR comments.
