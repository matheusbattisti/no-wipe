---
name: trava-ia
description: Configura a proteção do trava-ia no projeto atual, gerando as regras de segurança do Claude Code, Codex, Cursor, Copilot CLI e Antigravity a partir de um arquivo protecao-ia.json. Use quando o usuário pedir para proteger o projeto ou o PC contra a IA apagar arquivos, ou para mudar o que fica bloqueado.
---

# Configurar o trava-ia no projeto

O trava-ia usa um arquivo só, `protecao-ia.json`, na raiz do projeto:

- `bloquear`: comandos que nenhuma IA roda, nem com aprovação.
- `perguntar`: comandos que sempre pedem a aprovação do usuário.
- `pastasDescartaveis`: pastas que podem ser apagadas sem perguntar (node_modules, dist, .next...).
- `mensagem`: o que a IA lê quando um comando é barrado.

## Passos

1. Se não existir `protecao-ia.json` na raiz do projeto, rode `npx -y trava-ia init` na raiz. Ele cria o arquivo com as regras padrão e gera a configuração de cada ferramenta.
2. Se o usuário pediu para mudar uma regra, edite só o `protecao-ia.json` e rode `npx -y trava-ia gerar`. Nunca edite à mão os arquivos gerados (`.claude/settings.json`, `.codex/rules/default.rules`, `.cursor/cli.json`, `copilot-seguro.ps1`, `antigravity-cli-settings.json`), porque eles são sobrescritos.
3. Mostre ao usuário, em poucas linhas e em português, o que ficou bloqueado e o que pede aprovação.
4. Lembre que o Codex só lê `.codex/` depois que o usuário confia na pasta, e que a configuração do Antigravity precisa ser copiada para `~/.gemini/antigravity-cli/settings.json`.

Para conferir um comando sem executar nada: `npx -y trava-ia checar "comando"`.
