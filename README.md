# no-wipe

Stop AI coding agents from wiping your files. One rules file, `no-wipe.json`, becomes the safety config for **Claude Code, Codex, Cursor, Copilot CLI and Antigravity**.

AI agents that run terminal commands have already wiped entire drives on Windows. In most cases a path silently turned into the drive root: an empty variable, a Windows 8.3 short name (`USERNA~1`), or `C:\` converted to `/c/` by Git Bash. no-wipe blocks those commands before they run.

> Em português: veja [abaixo](#português).

## Install as a Claude Code plugin

```
claude plugin install no-wipe --marketplace matheusbattisti/no-wipe
```

The plugin adds a hook that runs before every terminal command (Bash and PowerShell) and blocks:

- bulk deletes: `rm -r`, `Remove-Item -Recurse`, `rd /s`, `del /s`, `find -delete`, `git clean -f`, `robocopy /MIR`, `[IO.Directory]::Delete`
- paths built from a variable, Windows short names, drive roots and Git Bash `/c/` paths
- anything on the `block` list of your `no-wipe.json`

Disposable folders (`node_modules`, `dist`, `.next`...) can still be deleted by a plain path inside the project.

Inside Claude Code, `/no-wipe:no-wipe` sets up the rules in the project.

## Install as a skill (Claude Code, Codex, Cursor and others)

```
npx skills add matheusbattisti/no-wipe
```

## Use with any agent

```
npx no-wipe init
```

Creates `no-wipe.json` in the current folder and generates:

| Tool | Generated file |
|---|---|
| Claude Code | `.claude/settings.json` and the hook in `.claude/hooks/` |
| Codex | `.codex/config.toml` (sandbox) and `.codex/rules/default.rules` |
| Cursor (CLI) | `.cursor/cli.json` |
| Copilot CLI | `copilot-guarded.ps1` (starts it sandboxed with the blocks) |
| Antigravity (CLI) | `antigravity-cli-settings.json` (copy to `~/.gemini/antigravity-cli/settings.json`) |

Changed a rule? Edit `no-wipe.json` and run `npx no-wipe generate`.

Check a command without running anything:

```
npx no-wipe check "rm -rf C:/Users/USERNA~1"
```

## no-wipe.json

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
2. **The tool's own guard**: no-wipe plus the tool's sandbox when it has one.
3. **You approve**: no mode that runs everything without asking.
4. **A copy first**: a git commit before each task and Windows File History on. Deleting from the terminal skips the Recycle Bin.

## Português

O no-wipe impede agentes de IA de apagar seus arquivos. Um arquivo de regras, o `no-wipe.json`, vira a configuração de segurança do Claude Code, Codex, Cursor, Copilot CLI e Antigravity. As mensagens saem em português quando o sistema está em português, ou com `"lang": "pt"` no arquivo.

- Plugin do Claude Code: `claude plugin install no-wipe --marketplace matheusbattisti/no-wipe`
- Skill: `npx skills add matheusbattisti/no-wipe`
- Qualquer IA: `npx no-wipe init`, e depois de editar as regras, `npx no-wipe generate`
- Conferir um comando sem rodar: `npx no-wipe check "comando"`

## License

MIT
