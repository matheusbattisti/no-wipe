# trava-ia

Proteção contra IA apagando arquivos. Um arquivo de regras, o `protecao-ia.json`, vira a configuração de segurança do **Claude Code, Codex, Cursor, Copilot CLI e Antigravity**.

Agentes de IA que rodam comandos no terminal já apagaram discos inteiros no Windows. Na maioria dos casos, um caminho virou a raiz do disco sem ninguém ver: uma variável vazia, um nome curto do Windows (`USUARI~1`) ou o `C:\` convertido para `/c/` no Git Bash. O trava-ia barra esses comandos antes de eles rodarem.

## Instalar como plugin do Claude Code

```
claude plugin install trava-ia --marketplace matheusbattisti/trava-ia
```

O plugin instala um hook que roda antes de todo comando de terminal (Bash e PowerShell) e barra:

- apagar em massa: `rm -r`, `Remove-Item -Recurse`, `rd /s`, `del /s`, `find -delete`, `git clean -f`, `robocopy /MIR`, `[IO.Directory]::Delete`
- caminhos que dependem de variável, nome curto do Windows, raiz do disco ou `/c/` do Git Bash
- os comandos da lista `bloquear` do seu `protecao-ia.json`

Pastas descartáveis (`node_modules`, `dist`, `.next`...) continuam podendo ser apagadas por caminho simples dentro do projeto.

Dentro do Claude Code, `/trava-ia:configurar` cria as regras no projeto.

## Usar com qualquer IA

```
npx trava-ia init
```

Cria o `protecao-ia.json` na pasta atual e gera:

| Ferramenta | Arquivo gerado |
|---|---|
| Claude Code | `.claude/settings.json` e o hook em `.claude/hooks/` |
| Codex | `.codex/config.toml` (sandbox) e `.codex/rules/default.rules` |
| Cursor (CLI) | `.cursor/cli.json` |
| Copilot CLI | `copilot-seguro.ps1` (abre com sandbox e bloqueios) |
| Antigravity (CLI) | `antigravity-cli-settings.json` (copie para `~/.gemini/antigravity-cli/settings.json`) |

Mudou uma regra? Edite o `protecao-ia.json` e rode `npx trava-ia gerar`.

Conferir um comando sem executar nada:

```
npx trava-ia checar "rm -rf C:/Users/USUARI~1"
```

## O protecao-ia.json

```json
{
  "bloquear": ["git clean", "git reset --hard", "Format-Volume", "Clear-Disk", "diskpart"],
  "perguntar": ["rm", "rmdir", "rd", "del", "erase", "Remove-Item", "robocopy", "git push --force"],
  "pastasDescartaveis": ["node_modules", ".next", "dist", "build", "out", "coverage", ".turbo", ".cache", ".vite", "tmp", "temp"],
  "mensagem": "Não apague arquivos em massa pelo terminal. Liste os caminhos exatos que quer apagar e peça para o usuário."
}
```

## Limites

Regras e hooks leem o texto do comando. Eles pegam os casos conhecidos, mas não são uma fronteira de segurança completa. Junte com as outras camadas:

1. **Ambiente separado**: Windows Sandbox, WSL ou máquina virtual.
2. **Trava da ferramenta**: o trava-ia mais o sandbox da própria ferramenta, quando existe.
3. **Você aprova**: nada de modo que libera tudo sem perguntar.
4. **Cópia antes**: commit no git antes de cada tarefa e Histórico de Arquivos do Windows ligado. Apagar pelo terminal não passa pela Lixeira.

## Licença

MIT
