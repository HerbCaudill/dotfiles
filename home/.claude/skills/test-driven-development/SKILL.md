---
name: test-driven-development
description: Use when implementing a feature, reproducible bug fix, refactor, or behavior change after the target behavior is understood.
---

# Test-driven development

Write a test first, watch it fail for the expected reason, write the smallest change that passes it, then refactor while green.

## When to use it

Use TDD for features, reproducible bugs, refactors, and behavior changes.

Do not force TDD onto research, documentation, configuration, disposable commands, or an investigation whose failure boundary is still unknown. Diagnose first. Add a regression test once you can state stable expected behavior.

## Red, green, refactor

1. Write one minimal test for behavior a user or caller cares about.
2. Run it and confirm that it fails because the behavior is missing, not because the test is broken.
3. If it passes immediately, correct the test or confirm that no production change is needed.
4. Implement only enough production code to pass.
5. Run the focused test, then the relevant broader suite.
6. Refactor names, duplication, and structure without changing behavior.
7. Repeat for the next behavior.

Do not write production behavior before its test, alter a correct test merely to make it pass, or add speculative options that the test does not require.

## Test quality

A good test:

- has a name that states one behavior;
- exercises real code and uses mocks only at expensive or nondeterministic boundaries;
- checks public outcomes rather than implementation details;
- fails clearly when the behavior regresses; and
- covers meaningful errors and edge cases without duplicating the implementation.

## Completion check

Before finishing, confirm that:

- each new or changed behavior has suitable coverage;
- you observed each new test fail for the expected reason;
- focused and relevant broader tests pass; and
- test output has no unexpected errors or warnings.
