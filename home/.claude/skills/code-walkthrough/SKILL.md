---
name: code-walkthrough
description: Use when the user asks for a walkthrough or explanation of code, a code change, diff, branch, or pull request.
---

# Code walkthrough

Analyze the code or changes carefully before providing a walkthrough.

Respond inline, not with an artifact.

In a couple of sentences, lay out the motivation for the code or the changes - what problem is this codebase, this component, or this diff solving? Use the `writing` skill for this.

Feel free to sketch out diagrams to illustrate the flow of data, the relationships between components, or the overall architecture.

Go file by file.

Start with the apex consumer of the code: For example show me what the user will see, or how changes affect the way a component is authored. Then work your way down to the lower-level components, utilities, and helpers.
