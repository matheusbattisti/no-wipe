#!/usr/bin/env node
// trava-ia: um arquivo de regras (protecao-ia.json) que vira a configuração de segurança
// do Claude Code, Codex, Cursor, Copilot CLI e Antigravity.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOOK = path.join(RAIZ, "scripts", "barrar-delecao.cjs");
const PADRAO = path.join(RAIZ, "protecao-ia.padrao.json");
const [, , comando = "ajuda", ...resto] = process.argv;

const json = (o) => JSON.stringify(o, null, 2) + "\n";
const tokens = (c) => c.trim().split(/\s+/);

function escrever(projeto, rel, conteudo) {
  const destino = path.join(projeto, rel);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, conteudo);
  console.log("  " + rel.replace(/\//g, path.sep));
}

function lerRegras(projeto) {
  const arq = path.join(projeto, "protecao-ia.json");
  if (!fs.existsSync(arq)) {
    console.error(`Não achei ${arq}. Rode primeiro: npx trava-ia init`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(arq, "utf8"));
}

function gerar(projeto) {
  const cfg = lerRegras(projeto);
  const { bloquear = [], perguntar = [], mensagem = "" } = cfg;
  console.log(`\nGerando a configuração de cada IA em ${projeto}\n`);

  // Claude Code
  const cc = (l) => l.flatMap((c) => [`Bash(${c} *)`, `PowerShell(${c} *)`]);
  escrever(projeto, ".claude/settings.json", json({
    env: { CLAUDE_CODE_USE_POWERSHELL_TOOL: "1" },
    permissions: { disableBypassPermissionsMode: "disable", deny: cc(bloquear), ask: cc(perguntar) },
    hooks: { PreToolUse: [{ matcher: "Bash|PowerShell", hooks: [{
      type: "command", command: "node",
      args: ["${CLAUDE_PROJECT_DIR}/.claude/hooks/barrar-delecao.cjs"],
      timeout: 10, onFailure: "block",
    }] }] },
  }));
  escrever(projeto, ".claude/hooks/barrar-delecao.cjs", fs.readFileSync(HOOK, "utf8"));

  // Codex
  escrever(projeto, ".codex/config.toml", [
    "# Gerado pelo trava-ia a partir do protecao-ia.json",
    'sandbox_mode = "workspace-write"', 'approval_policy = "on-request"', "",
    "[sandbox_workspace_write]", "network_access = false", "",
    "[windows]", 'sandbox = "elevated"', "",
  ].join("\n"));
  const PERGUNTA = "Este comando precisa da aprovação do usuário antes de rodar.";
  const regra = (c, decisao) => {
    const t = tokens(c);
    const v = [t];
    if (/[A-Z]/.test(c)) v.push(t.map((x) => x.toLowerCase()));
    if (t.length === 1 && ["rd", "rmdir", "del", "erase"].includes(t[0])) v.push(["cmd", "/c", t[0]]);
    return v.map((p) => `prefix_rule(\n    pattern = ${JSON.stringify(p)},\n    decision = "${decisao}",\n    justification = ${JSON.stringify(decisao === "prompt" ? PERGUNTA : mensagem)},\n)\n`).join("\n");
  };
  escrever(projeto, ".codex/rules/default.rules", [
    "# Gerado pelo trava-ia a partir do protecao-ia.json",
    ...bloquear.map((c) => regra(c, "forbidden")),
    ...perguntar.map((c) => regra(c, "prompt")),
  ].join("\n"));

  // Cursor (CLI): fora da lista de permitidos já pede aprovação
  escrever(projeto, ".cursor/cli.json", json({ permissions: {
    allow: ["Shell(ls)", "Shell(dir)", "Shell(git status)", "Shell(git diff)", "Shell(npm run)"],
    deny: [...bloquear.map((c) => `Shell(${c})`), "Write(../**)"],
  } }));

  // Copilot CLI
  escrever(projeto, "copilot-seguro.ps1", [
    "# Gerado pelo trava-ia. Abre o Copilot CLI no sandbox com os bloqueios.",
    `copilot --sandbox ${bloquear.map((c) => `--deny-tool='shell(${c})'`).join(" ")} @args`, "",
  ].join("\n"));

  // Antigravity (CLI): copie para ~/.gemini/antigravity-cli/settings.json
  escrever(projeto, "antigravity-cli-settings.json", json({
    enableTerminalSandbox: true,
    permissions: { allow: [], deny: bloquear.map((c) => `command(${c})`), ask: perguntar.map((c) => `command(${c})`) },
  }));

  console.log(`\nPronto: ${bloquear.length} comandos bloqueados e ${perguntar.length} que pedem aprovação, em 5 ferramentas.`);
  console.log("Para mudar uma regra, edite o protecao-ia.json e rode: npx trava-ia gerar\n");
}

function checar(texto) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command: texto } }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: process.cwd() },
  });
  if (r.status === 2) {
    console.log("\x1b[31mBLOQUEADO\x1b[0m  " + texto);
    console.log("  " + r.stderr.trim().replace(/\n/g, "\n  "));
  } else {
    console.log("\x1b[32mLIBERADO\x1b[0m   " + texto);
  }
  return r.status;
}

switch (comando) {
  case "init": {
    const projeto = path.resolve(resto[0] || ".");
    const arq = path.join(projeto, "protecao-ia.json");
    if (!fs.existsSync(arq)) {
      fs.mkdirSync(projeto, { recursive: true });
      fs.copyFileSync(PADRAO, arq);
      console.log(`\nCriei ${arq} com as regras padrão.`);
    }
    gerar(projeto);
    break;
  }
  case "gerar":
    gerar(path.resolve(resto[0] || "."));
    break;
  case "checar":
    if (!resto.length) { console.error('Uso: npx trava-ia checar "comando"'); process.exit(1); }
    checar(resto.join(" "));
    break;
  case "testar": {
    const r = spawnSync(process.execPath, [path.join(RAIZ, "test", "testar-hook.mjs"), ...resto], { stdio: "inherit" });
    process.exit(r.status ?? 1);
  }
  default:
    console.log(`
trava-ia: proteção contra IA apagando arquivos (Claude Code, Codex, Cursor, Copilot, Antigravity)

  npx trava-ia init [pasta]      cria o protecao-ia.json e gera a configuração de cada IA
  npx trava-ia gerar [pasta]     gera de novo depois de editar o protecao-ia.json
  npx trava-ia checar "comando"  mostra se o comando seria bloqueado (não executa nada)
  npx trava-ia testar            roda os testes do hook
`);
}
