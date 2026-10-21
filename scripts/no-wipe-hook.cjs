#!/usr/bin/env node
// no-wipe: PreToolUse hook for Claude Code.
// Reads the tool call from stdin and blocks (exit 2) bulk-delete commands before they run,
// including paths that silently resolve to a drive root (empty variable, Windows 8.3 short
// name like USERNA~1, or C:\ converted to /c/ by Git Bash).
// Deleting disposable folders (node_modules, dist, .next...) by a plain relative path stays allowed.

const fs = require("fs");
const path = require("path");

// Optional flags (used by the CLI and the tests): --project <dir> and --no-log.
const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? (argv[i + 1] || true) : undefined; };
const PROJECT_DIR = flag("--project") || process.env.CLAUDE_PROJECT_DIR;
const NO_LOG = argv.includes("--no-log");

// Rules: the project's no-wipe.json, then one next to this file, then the bundled default.
function loadConfig() {
  const candidates = [
    PROJECT_DIR && path.join(PROJECT_DIR, "no-wipe.json"),
    path.join(__dirname, "no-wipe.json"),
    path.join(__dirname, "..", "no-wipe.default.json"),
  ].filter(Boolean);
  for (const file of candidates) {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* try next */ }
  }
  return {};
}
const CONFIG = loadConfig();
// Messages follow "lang" in the config, then --lang, then the system language.
const PT = /^pt/i.test(CONFIG.lang || flag("--lang") || Intl.DateTimeFormat().resolvedOptions().locale || "");
const t = (en, pt) => (PT ? pt : en);
// "block" entries are matched word by word: the command is split into segments at ; & | ( )
// and each segment into words, and an entry matches when its words appear in a row.
const BLOCK = (CONFIG.block || []).map((c) => ({ words: c.trim().toLowerCase().split(/\s+/), name: c }));
function commandWords(cmd) {
  return cmd.toLowerCase().split(/[;&|()\n]+/).map((seg) =>
    seg.replace(/["'`]/g, " ").trim().split(/\s+/).filter(Boolean));
}
function hasSequence(segments, words) {
  return segments.some((seg) => {
    for (let i = 0; i + words.length <= seg.length; i++) {
      if (words.every((w, k) => seg[i + k] === w)) return true;
    }
    return false;
  });
}

const SAFE_TO_DELETE = new Set((CONFIG.safeToDelete || [
  "node_modules", ".next", "dist", "build", "out", "coverage", ".turbo", ".cache", ".vite", "tmp", "temp",
]).map((p) => p.toLowerCase()));
const MESSAGE = CONFIG.message || t(
  "Do not bulk-delete files from the terminal. List the exact paths you want to delete and ask the user.",
  "Não apague arquivos em massa pelo terminal. Liste os caminhos exatos que quer apagar e peça para o usuário."
);

// Commands that delete in bulk (bash, PowerShell and cmd).
const DANGEROUS = [
  { re: /\brm\s+(?:[^|;&\n]*\s)?-(?:[a-z]*r[a-z]*|-recursive)\b/i, name: t("recursive rm", "rm recursivo") },
  { re: /\b(?:rmdir|rd)\b[^|;&\n]*\s\/s\b/i, name: "rmdir /s" },
  { re: /\b(?:del|erase)\b[^|;&\n]*\s\/s\b/i, name: "del /s" },
  { re: /\b(?:remove-item|ri|rm|rmdir|del|erase|rd)\b[^|;&\n]*\s-r(?:ecurse|ecurs|ecur|ecu|ec|e)?\b/i, name: "Remove-Item -Recurse" },
  { re: /\|\s*(?:remove-item|ri|rm|del)\b/i, name: t("file list piped into Remove-Item", "lista de arquivos jogada no Remove-Item") },
  { re: /\b(?:remove-item|ri|rm|del|erase)\s[^|;&\n]*[*?]/i, name: t("delete with wildcard (*)", "apagar com coringa (*)") },
  { re: /\bfind\b[^|;&\n]*\s-delete\b/i, name: "find -delete" },
  { re: /\b(?:rimraf|del-cli|trash-cli)\b/i, name: "rimraf" },
  { re: /\b(?:rmSync|rmdirSync|fs\.rm|fs\.rmdir|rmtree|shutil\.rmtree)\b/i, name: t("delete from a script (node/python)", "apagar por script (node/python)") },
  { re: /\[(?:system\.)?io\.(?:directory|directoryinfo)\]::delete|\.delete\(\s*[^)]*\$?true\s*\)/i, name: t("delete folder via .NET ([IO.Directory]::Delete)", "apagar pasta pelo .NET ([IO.Directory]::Delete)") },
  { re: /\bgit\s+clean\b[^|;&\n]*-[a-z]*f/i, name: "git clean -f" },
  { re: /\brobocopy\b[^|;&\n]*\/(?:mir|purge)\b/i, name: t("robocopy /MIR (mirroring deletes the target)", "robocopy /MIR (espelhar apaga o destino)") },
  { re: /\b(?:format-volume|clear-disk|diskpart|cipher\s+\/w)\b/i, name: t("format or wipe a disk", "formatar ou limpar disco") },
  { re: /\bformat\s+[a-z]:/i, name: t("format a drive", "format de unidade") },
  { re: /\s-(?:enc|encodedcommand|e)\s+[a-z0-9+/=]{16,}/i, name: t("encoded PowerShell command (can't tell what it does)", "comando PowerShell codificado (não dá pra ler o que faz)") },
];

function readInput() {
  try { return JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch { return {}; }
}

// Split a command into words, respecting quotes.
function split(cmd) {
  const parts = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(cmd))) parts.push(m[1] ?? m[2] ?? m[3]);
  return parts;
}

// Exception: a single delete command, not chained, whose targets are all
// disposable folders given by a plain relative path inside the project.
function isSafeDelete(cmd) {
  if (/[;|&\n`]/.test(cmd)) return false;
  const parts = split(cmd);
  if (!parts.length) return false;
  const verb = parts[0].toLowerCase();
  if (!["rm", "rmdir", "rd", "remove-item", "ri", "del"].includes(verb)) return false;

  const takesValue = new Set(["-erroraction", "-ea"]);
  const targets = [];
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    const pl = p.toLowerCase();
    if (takesValue.has(pl)) { i++; continue; }
    if (pl === "-path" || pl === "-literalpath") continue;
    if (/^-(include|exclude|filter)/.test(pl)) return false;
    if (/^-/.test(p)) continue;                                              // -rf, -Recurse, -Force
    if (/^\/[a-z]$/i.test(p) && ["rmdir", "rd", "del"].includes(verb)) continue; // /s /q
    targets.push(p);
  }
  if (!targets.length) return false;

  return targets.every((target) => {
    if (/[$%~*?]/.test(target)) return false;                  // variable, 8.3 short name, wildcard
    if (/^[a-z]:/i.test(target)) return false;                  // C:\...
    if (/^[\\/]/.test(target)) return false;                    // \ or / (root)
    if (target.split(/[\\/]+/).includes("..")) return false;    // goes up a folder
    const segs = target.split(/[\\/]+/).filter((x) => x && x !== ".");
    if (!segs.length) return false;                             // "." or "./" = the whole project
    return SAFE_TO_DELETE.has(segs[segs.length - 1].toLowerCase());
  });
}

// Extra hints explaining why the path is dangerous.
function pathWarnings(cmd) {
  const w = [];
  if (/\$(?!(?:true|false|null)\b)[\w{(]|\$env:|%[a-z_]+%/i.test(cmd)) w.push(t("the path depends on a variable, and an empty variable becomes the drive root", "o caminho depende de uma variável, e variável vazia vira a raiz do disco"));
  if (/[a-z0-9]{1,6}~\d/i.test(cmd)) w.push(t("the path uses a Windows short name (like USERNA~1)", "o caminho usa nome curto do Windows (tipo USUARI~1)"));
  if (/(^|\s)["']?(?:[a-z]:)?[\\/]["']?(\s|$)|[a-z]:[\\/]?\*/i.test(cmd)) w.push(t("the target is a drive root", "o alvo é a raiz de um disco"));
  if (/(^|[\s"'])\/[a-z]\/[^\s]/i.test(cmd)) w.push(t("Git Bash style /c/... path, which can be converted without you noticing", "caminho no estilo /c/... do Git Bash, que pode ser convertido sem você ver"));
  return w;
}

function log(project, line) {
  if (NO_LOG) return;
  try {
    const dir = path.join(project, ".claude");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "no-wipe.log"), `[${new Date().toISOString()}] ${line}\n`);
  } catch { /* logging is optional */ }
}

function main() {
  const input = readInput();
  const cmd = String(input?.tool_input?.command ?? "");
  if (!cmd.trim()) process.exit(0);
  const project = PROJECT_DIR || input.cwd || process.cwd();
  const label = t("BLOCKED by no-wipe", "BLOQUEADO pelo no-wipe");

  const segments = commandWords(cmd);
  const banned = BLOCK.find((b) => hasSequence(segments, b.words));
  if (banned) {
    log(project, `BLOCKED (${banned.name}): ${cmd}`);
    process.stderr.write(`${label}: "${banned.name}" ${t("is on the blocked list.", "está na lista de comandos proibidos.")}\n${MESSAGE}\n`);
    process.exit(2);
  }

  const hit = DANGEROUS.find((p) => p.re.test(cmd));
  if (!hit || isSafeDelete(cmd)) process.exit(0);

  log(project, `BLOCKED (${hit.name}): ${cmd}`);
  const msg = [
    `${label}: ${hit.name}.`,
    ...pathWarnings(cmd).map((s) => `- ${t("Warning", "Atenção")}: ${s}.`),
    MESSAGE,
  ].join("\n");
  process.stderr.write(msg + "\n");
  process.exit(2);
}

main();
