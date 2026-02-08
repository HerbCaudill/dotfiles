---
name: investigate-issues
description: Use when there are open issues that need investigation before work can begin. Finds uninvestigated tasks and spawns parallel subagents to research root causes, identify files, and suggest fixes.
user_invocation: investigate-issues
---

# Investigate Issues

Finds open beads issues without an `investigated` label and dispatches parallel subagents to research each one. Subagents determine whether the issue needs more detail, and if so, investigate the codebase to identify files, root causes, and suggested changes.

## Usage

`/investigate-issues` - run from any git repository with beads set up

## Process

### Discover uninvestigated issues

```bash
bd list --status=open --json --limit=0
```

Filter the JSON output to exclude issues that already have the `investigated` label. If no uninvestigated issues remain, report and stop.

### Dispatch investigators in parallel

Launch all investigations simultaneously using parallel Task tool calls.

- `subagent_type: "general-purpose"`
- `model: "sonnet"`
- Max 8 parallel subagents; if more issues exist, batch them

**Subagent prompt template**

> You are an issue investigator. Your job is to determine whether this issue has enough detail for an engineer to start working on it, and if not, investigate the codebase to fill in the gaps.
>
> ## Issue: {title}
>
> **ID:** {id}
>
> **Description:**
> {description}
>
> ### Process
>
> 1. **Evaluate** whether the issue description provides enough context for an engineer to start working immediately. An issue has enough detail if it clearly identifies what to change and where. Issues that are vague, lack file references, or describe symptoms without root causes need investigation.
>
> 2. **If the issue is already well-specified:** Skip to step 4.
>
> 3. **If the issue needs investigation:**
>    - Search the codebase to identify the relevant files and code paths
>    - Diagnose the root cause if it's a bug
>    - Identify the specific functions, components, or modules involved
>    - Suggest concrete code changes or an approach
>    - Write your findings as a comment:
>      ```bash
>      bd comments add {id} "YOUR FINDINGS HERE" --author=Investigator
>      ```
>      Structure your comment as:
>      - **Files involved:** list of relevant file paths
>      - **Root cause / Analysis:** what you found
>      - **Suggested approach:** specific changes to make
>
> 4. **Add the investigated label:**
>    ```bash
>    bd label add {id} investigated
>    ```
>
> ### Guidelines
>
> - Do NOT make any code changes. Investigation only.
> - Do NOT create new issues. Just investigate the one you were given.
> - Be specific: name files, functions, and line numbers.
> - Keep comments concise but actionable.

### Report results

After all subagents complete, summarize what was investigated and any notable findings.
