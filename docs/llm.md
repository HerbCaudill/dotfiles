# Headless LLM calls

`llm` runs a prompt without the caller naming a model. Callers name a model role, and `llm` runs that role's harness, model and effort.

```bash
llm run --role default --schema result.json < prompt.md
llm run --role author --sandbox workspace-write --cwd ~/Code/HerbCaudill/leo < prompt.md
llm run --role default --image frame-01.png --image frame-02.png < prompt.md
llm resolve --role bulk
llm roles
```

The prompt comes from standard input and the final message goes to standard output. The sandbox defaults to `read-only`.

## Where roles come from

The roles are the "Model roles" table in `home/.claude/AGENTS.md`, the global instructions every agent already reads. `llm` parses that table on each call, so agents and scripts use the same settings, and changing a role is a one-line edit there. The Harness column uses each adapter's title ("Claude Code", "Codex"), and the Model column holds the exact model ID the harness expects. `llm` fails loudly if the table is missing or names a harness or effort it doesn't know.

Use `llm resolve --role <name>` when a script has to start a harness itself, such as a Codex run that streams JSONL events or a T3 thread. It prints the role as JSON, with `harness`, `model` and `effort`. Pass all three on; a tool's default effort is not the role's effort.

A failed run is reported, not retried on another model, because the role is a deliberate choice.

## Images

`--image` attaches a file and can be repeated. Codex gets each one through `--image`. `claude -p` has no image flag, so `llm` lists the paths at the end of the prompt, gives Claude read access to their folders and asks it to read them with its Read tool.

## Adding a harness

Write an adapter in `scripts/llm/harnesses.ts` and list it in `HARNESSES`. An adapter has the title the roles table uses, builds its command from a request and a role, and reads its final message.
