---
name: wipe-guard
description: Sets up wipe-guard in the current project so AI coding agents can't bulk-delete files. Generates the safety config for Claude Code, Codex, Cursor, Copilot CLI and Antigravity from one wipe-guard.json file. Use when the user asks to protect the project or computer from an AI deleting files, or to change what is blocked.
---

# Set up wipe-guard in the project

wipe-guard uses one file, `wipe-guard.json`, at the project root:

- `block`: commands no agent may run, even with approval.
- `ask`: commands that always need the user's approval.
- `safeToDelete`: folders that can be deleted without asking (node_modules, dist, .next...).
- `message` (optional): what the agent reads when a command is blocked.
- `lang` (optional): `"pt"` or `"en"` for the messages. Defaults to the system language.

## Steps

1. If there is no `wipe-guard.json` at the project root, run `npx -y wipe-guard init` there. It creates the file with the default rules and generates each tool's config.
2. To change a rule, edit only `wipe-guard.json` and run `npx -y wipe-guard generate`. Never hand-edit the generated files (`.claude/settings.json`, `.codex/rules/default.rules`, `.cursor/cli.json`, `copilot-guarded.ps1`, `antigravity-cli-settings.json`); they get overwritten.
3. Tell the user, in a few lines and in their language, what is blocked and what asks for approval.
4. Remind them that Codex only reads `.codex/` after they trust the folder, and that the Antigravity file has to be copied to `~/.gemini/antigravity-cli/settings.json`.

To check a command without running it: `npx -y wipe-guard check "command"`.
