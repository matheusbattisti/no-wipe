# wipe-guard

Stop AI coding agents from wiping your files. One rules file, `wipe-guard.json`, becomes the safety config for **Claude Code, Codex, Cursor, Copilot CLI and Antigravity**.

AI agents that run terminal commands have already wiped entire drives on Windows. In most cases a path silently turned into the drive root: an empty variable, a Windows 8.3 short name (`USERNA~1`), or `C:\` converted to `/c/` by Git Bash. wipe-guard blocks those commands before they run.

> Em português: veja [abaixo](#português).

## Install as a Claude Code plugin

```
claude plugin install wipe-guard --marketplace matheusbattisti/wipe-guard
```

The plugin adds a hook that runs before every terminal command (Bash and PowerShell) and blocks:

- bulk deletes: `rm -r`, `Remove-Item -Recurse`, `rd /s`, `del /s`, `find -delete`, `git clean -f`, `robocopy /MIR`, `[IO.Directory]::Delete`
- paths built from a variable, Windows short names, drive roots and Git Bash `/c/` paths
- anything on the `block` list of your `wipe-guard.json`

Disposable folders (`node_modules`, `dist`, `.next`...) can still be deleted by a plain path inside the project.

Inside Claude Code, `/wipe-guard:wipe-guard` sets up the rules in the project.

## Install as a skill (Claude Code, Codex, Cursor and others)

```
npx skills add matheusbattisti/wipe-guard
```

## Use with any agent

```
npx wipe-guard init
```

Creates `wipe-guard.json` in the current folder and generates:

| Tool | Generated file |
|---|---|
| Claude Code | `.claude/settings.json` and the hook in `.claude/hooks/` |
| Codex | `.codex/config.toml` (sandbox) and `.codex/rules/default.rules` |
| Cursor (CLI) | `.cursor/cli.json` |
| Copilot CLI | `copilot-guarded.ps1` (starts it sandboxed with the blocks) |
| Antigravity (CLI) | `antigravity-cli-settings.json` (copy to `~/.gemini/antigravity-cli/settings.json`) |

Changed a rule? Edit `wipe-guard.json` and run `npx wipe-guard generate`.

Check a command without running anything:

```
npx wipe-guard check "rm -rf C:/Users/USERNA~1"
```

## wipe-guard.json

```json
{
  "block": ["git clean", "git reset --hard", "Format-Volume", "Clear-Disk", "diskpart"],
  "ask": ["rm", "rmdir", "rd", "del", "erase", "Remove-Item", "robocopy", "git push --force"],
  "safeToDelete": ["node_modules", ".next", "dist", "build", "out", "coverage", ".turbo", ".cache", ".vite", "tmp", "temp"]
}
```

Optional keys: `message` (what the agent reads when blocked) and `lang` (`"en"` or `"pt"`; defaults to the system language).

## Limits

Rules and hooks read the command text. They catch the known cases but are not a complete security boundary. Combine them with:

1. **A separate environment**: Windows Sandbox, WSL or a virtual machine.
2. **The tool's own guard**: wipe-guard plus the tool's sandbox when it has one.
3. **You approve**: no mode that runs everything without asking.
4. **A copy first**: a git commit before each task and Windows File History on. Deleting from the terminal skips the Recycle Bin.

## Português

O wipe-guard impede agentes de IA de apagar seus arquivos. Um arquivo de regras, o `wipe-guard.json`, vira a configuração de segurança do Claude Code, Codex, Cursor, Copilot CLI e Antigravity. As mensagens saem em português quando o sistema está em português, ou com `"lang": "pt"` no arquivo.

- Plugin do Claude Code: `claude plugin install wipe-guard --marketplace matheusbattisti/wipe-guard`
- Skill: `npx skills add matheusbattisti/wipe-guard`
- Qualquer IA: `npx wipe-guard init`, e depois de editar as regras, `npx wipe-guard generate`
- Conferir um comando sem rodar: `npx wipe-guard check "comando"`

## License

MIT
