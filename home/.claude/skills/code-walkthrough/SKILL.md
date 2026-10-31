---
name: code-walkthrough
description: "Explain code, a diff, branch, or PR inline. Use showcase for a staged live demonstration with checkpoints."
---

# Code walkthrough

Analyze the code or changes carefully before providing a walkthrough.

Respond inline, not with an artifact.

In a couple of sentences, lay out the motivation for the code or the changes - what problem is this codebase, this component, or this diff solving? Use the `writing` skill for this.

Feel free to sketch out diagrams to illustrate the flow of data, the relationships between components, or the overall architecture.

Pick the smallest view that makes each point clear: pseudocode for logic, a call tree for runtime flow, a component tree with file paths for UI structure, a shallow file tree for a refactor, or a sequence diagram for messages between processes. For a change, prefer a diff of that shape – the component tree, file tree, or call tree with `+` and `-` lines – so the structure of the change is visible before the code. Keep only the calls, files, props, and boundaries needed for the point at hand.

Go file by file.

Start with the apex consumer of the code: For example show me what the user will see, or how changes affect the way a component is authored. Then work your way down to the lower-level components, utilities, and helpers.
