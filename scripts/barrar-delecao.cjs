#!/usr/bin/env node
// Hook PreToolUse do Claude Code: barra comandos de apagar em massa antes de rodar.
// Lê o JSON do Claude Code pela entrada padrão e, se o comando for perigoso,
// sai com código 2 e explica o motivo (o Claude Code cancela o comando e mostra o motivo pro agente).
// Libera só apagar pastas descartáveis (node_modules, .next, dist...) por caminho relativo simples.

const fs = require("fs");
const path = require("path");

// Regras: primeiro o protecao-ia.json do projeto, depois o que está ao lado deste arquivo,
// por último o padrão que vem com o trava-ia.
function lerConfig() {
  const candidatos = [
    process.env.CLAUDE_PROJECT_DIR && path.join(process.env.CLAUDE_PROJECT_DIR, "protecao-ia.json"),
    path.join(__dirname, "protecao-ia.json"),
    path.join(__dirname, "..", "protecao-ia.padrao.json"),
  ].filter(Boolean);
  for (const arq of candidatos) {
    try { return JSON.parse(fs.readFileSync(arq, "utf8")); } catch { /* tenta o próximo */ }
  }
  return {};
}
const CONFIG = lerConfig();
const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const BLOQUEAR = (CONFIG.bloquear || []).map((c) => ({
  re: new RegExp("(^|[\\s;&|(\"'])" + c.trim().split(/\s+/).map(escapar).join("\\s+") + "(?=\\s|$|[;&|)\"'])", "i"),
  nome: c,
}));
const PASTAS_DESCARTAVEIS = new Set((CONFIG.pastasDescartaveis || [
  "node_modules", ".next", "dist", "build", "out", "coverage", ".turbo", ".cache", ".vite", "tmp", "temp",
]).map((p) => p.toLowerCase()));

// Comandos que apagam em massa (bash, PowerShell e cmd).
const PADROES_PERIGOSOS = [
  { re: /\brm\s+(?:[^|;&\n]*\s)?-(?:[a-z]*r[a-z]*|-recursive)\b/i, nome: "rm recursivo" },
  { re: /\b(?:rmdir|rd)\b[^|;&\n]*\s\/s\b/i, nome: "rmdir /s" },
  { re: /\b(?:del|erase)\b[^|;&\n]*\s\/s\b/i, nome: "del /s" },
  { re: /\b(?:remove-item|ri|rm|rmdir|del|erase|rd)\b[^|;&\n]*\s-r(?:ecurse|ecurs|ecur|ecu|ec|e)?\b/i, nome: "Remove-Item -Recurse" },
  { re: /\|\s*(?:remove-item|ri|rm|del)\b/i, nome: "lista de arquivos jogada no Remove-Item" },
  { re: /\b(?:remove-item|ri|rm|del|erase)\s[^|;&\n]*[*?]/i, nome: "apagar com coringa (*)" },
  { re: /\bfind\b[^|;&\n]*\s-delete\b/i, nome: "find -delete" },
  { re: /\b(?:rimraf|del-cli|trash-cli)\b/i, nome: "rimraf" },
  { re: /\b(?:rmSync|rmdirSync|fs\.rm|fs\.rmdir|rmtree|shutil\.rmtree)\b/i, nome: "apagar por script (node/python)" },
  { re: /\[(?:system\.)?io\.(?:directory|directoryinfo)\]::delete|\.delete\(\s*[^)]*\$?true\s*\)/i, nome: "apagar pasta pelo .NET ([IO.Directory]::Delete)" },
  { re: /\bgit\s+clean\b[^|;&\n]*-[a-z]*f/i, nome: "git clean -f" },
  { re: /\brobocopy\b[^|;&\n]*\/(?:mir|purge)\b/i, nome: "robocopy /MIR (espelhar apaga o destino)" },
  { re: /\b(?:format-volume|clear-disk|diskpart|cipher\s+\/w)\b/i, nome: "formatar ou limpar disco" },
  { re: /\bformat\s+[a-z]:/i, nome: "format de unidade" },
  { re: /\s-(?:enc|encodedcommand|e)\s+[a-z0-9+/=]{16,}/i, nome: "comando PowerShell codificado (não dá pra ler o que faz)" },
];

function lerEntrada() {
  try {
    return JSON.parse(fs.readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

// Quebra o comando em pedaços respeitando aspas.
function quebrar(comando) {
  const pedacos = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(comando))) pedacos.push(m[1] ?? m[2] ?? m[3]);
  return pedacos;
}

// Exceção: um único comando de apagar, sem encadear, cujos alvos são todos
// pastas descartáveis por caminho relativo simples dentro do projeto.
function eApagarPastaDescartavel(comando) {
  if (/[;|&\n`]/.test(comando)) return false;
  const pedacos = quebrar(comando);
  if (!pedacos.length) return false;
  const verbo = pedacos[0].toLowerCase();
  if (!["rm", "rmdir", "rd", "remove-item", "ri", "del"].includes(verbo)) return false;

  const comValor = new Set(["-erroraction", "-ea"]);
  const alvos = [];
  for (let i = 1; i < pedacos.length; i++) {
    const p = pedacos[i];
    const pl = p.toLowerCase();
    if (comValor.has(pl)) { i++; continue; }
    if (pl === "-path" || pl === "-literalpath") continue;
    if (/^-(include|exclude|filter)/.test(pl)) return false;
    if (/^-/.test(p)) continue; // -rf, -Recurse, -Force
    if (/^\/[a-z]$/i.test(p) && ["rmdir", "rd", "del"].includes(verbo)) continue; // /s /q
    alvos.push(p);
  }
  if (!alvos.length) return false;

  return alvos.every((alvo) => {
    if (/[$%~*?]/.test(alvo)) return false;          // variável, atalho 8.3, coringa
    if (/^[a-z]:/i.test(alvo)) return false;          // C:\...
    if (/^[\\/]/.test(alvo)) return false;            // \ ou / (raiz)
    if (alvo.split(/[\\/]+/).includes("..")) return false; // sobe de pasta
    const partes = alvo.split(/[\\/]+/).filter((x) => x && x !== ".");
    if (!partes.length) return false;                 // "." ou "./" = o projeto inteiro
    return PASTAS_DESCARTAVEIS.has(partes[partes.length - 1].toLowerCase());
  });
}

// Avisos extras que explicam por que o caminho é perigoso.
function sinaisDeCaminhoQuebrado(comando) {
  const sinais = [];
  if (/\$(?!(?:true|false|null)\b)[\w{(]|\$env:|%[a-z_]+%/i.test(comando)) sinais.push("o caminho depende de uma variável, e variável vazia vira a raiz do disco");
  if (/[a-z0-9]{1,6}~\d/i.test(comando)) sinais.push("o caminho usa nome curto do Windows (tipo USUARI~1)");
  if (/(^|\s)["']?(?:[a-z]:)?[\\/]["']?(\s|$)|[a-z]:[\\/]?\*/i.test(comando)) sinais.push("o alvo é a raiz de um disco");
  if (/(^|[\s"'])\/[a-z]\/[^\s]/i.test(comando)) sinais.push("caminho no estilo /c/... do Git Bash, que pode ser convertido sem você ver");
  return sinais;
}

function registrar(projeto, linha) {
  try {
    const pasta = path.join(projeto, ".claude");
    fs.mkdirSync(pasta, { recursive: true });
    fs.appendFileSync(path.join(pasta, "trava-ia.log"), `[${new Date().toLocaleString("pt-BR")}] ${linha}\n`);
  } catch { /* log é opcional */ }
}

function main() {
  const entrada = lerEntrada();
  const comando = String(entrada?.tool_input?.command ?? "");
  if (!comando.trim()) process.exit(0);

  const proibido = BLOQUEAR.find((b) => b.re.test(comando));
  if (proibido) {
    registrar(process.env.CLAUDE_PROJECT_DIR || entrada.cwd || process.cwd(), `BLOQUEADO (${proibido.nome}): ${comando}`);
    process.stderr.write(`BLOQUEADO pelo trava-ia: "${proibido.nome}" está na lista de comandos proibidos.\n${CONFIG.mensagem || ""}\n`);
    process.exit(2);
  }

  const achado = PADROES_PERIGOSOS.find((p) => p.re.test(comando));
  if (!achado) process.exit(0);
  if (eApagarPastaDescartavel(comando)) process.exit(0);

  const sinais = sinaisDeCaminhoQuebrado(comando);
  const projeto = process.env.CLAUDE_PROJECT_DIR || entrada.cwd || process.cwd();
  registrar(projeto, `BLOQUEADO (${achado.nome}): ${comando}`);

  const msg = [
    `BLOQUEADO pelo trava-ia: ${achado.nome}.`,
    ...sinais.map((s) => `- Atenção: ${s}.`),
    CONFIG.mensagem || "Não tente outro comando para apagar. Liste os caminhos exatos e peça para o usuário.",
  ].join("\n");
  process.stderr.write(msg + "\n");
  process.exit(2);
}

main();
