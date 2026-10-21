// Testa o hook com comandos FALSOS: nada é executado, o hook só lê o texto.
// Uso: node testar-hook.mjs   (ou node testar-hook.mjs -v para ver as mensagens)
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
const AQUI = dirname(fileURLToPath(import.meta.url));
const HOOK = join(AQUI, "..", "scripts", "barrar-delecao.cjs");
const casos = [
  // [comando, esperado]
  ['Remove-Item -Recurse -Force "$pasta\\*"', "BLOQ"],
  ['Remove-Item -Path "C:\\Users\\USUARI~1\\AppData\\Local\\Temp\\*" -Recurse -Force', "BLOQ"],
  ['rm -rf "$TEMP_DIR/"', "BLOQ"],
  ['rm -rf /c/Users/matheus/projeto/cache', "BLOQ"],
  ['cmd /c rmdir /s /q C:\\Users\\JOOSIL~1\\proj\\tmp', "BLOQ"],
  ['rd /s /q .', "BLOQ"],
  ['del /s /q *.tmp', "BLOQ"],
  ['Get-ChildItem -Recurse -Filter *.tmp | Remove-Item -Force', "BLOQ"],
  ['find . -name "*.log" -delete', "BLOQ"],
  ['node -e "require(\'fs\').rmSync(\'C:/\', {recursive:true})"', "BLOQ"],
  ['git clean -fdx', "BLOQ"],
  ['robocopy vazio C:\\Users\\matheus\\Documents /MIR', "BLOQ"],
  ['Format-Volume -DriveLetter D', "BLOQ"],
  ['rm -rf ../outro-projeto/node_modules', "BLOQ"],
  ['rm -rf ./', "BLOQ"],
  ['Remove-Item C:\\Users\\matheus\\Desktop\\*', "BLOQ"],
  ['rm -rf node_modules && rm -rf C:/', "BLOQ"],
  ['powershell -enc SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoA', "BLOQ"],
  ['rm -rf \\', "BLOQ"],
  ['rm -rf "$(cygpath -u \'C:\\\')" 2>/dev/null', "BLOQ"],
  ['& C:\\msys64\\usr\\bin\\bash.exe -lc "export X=$(mktemp -d); rm -rf $X"', "BLOQ"],
  ['[IO.Directory]::Delete("C:\\Users\\x\\proj", $true)', "BLOQ"],
  ['cmd /c rd /s /q "C:\\$GetCurrent"', "BLOQ"],
  ['rm -rf C:/Users/MATHEU~1 2>/dev/null; rm -rf "$S/sub942"', "BLOQ"],
  // liberados
  ['rm -rf node_modules', "OK"],
  ['Remove-Item -Recurse -Force .next', "OK"],
  ['rmdir /s /q dist', "OK"],
  ['Remove-Item -Recurse -Force -Path .\\apps\\web\\.next -ErrorAction SilentlyContinue', "OK"],
  ['rm notas.txt', "OK"],
  ['npm run dev', "OK"],
  ['Get-ChildItem -Recurse', "OK"],
  ['git status', "OK"],
  ['ls -la', "OK"],
  ['npm install', "OK"],
  ['git commit -m "remove itens antigos"', "OK"],
];
let falhas = 0;
for (const [cmd, esp] of casos) {
  const r = spawnSync("node", [HOOK], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command: cmd }, cwd: tmpdir() }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: tmpdir(), TRAVA_IA_SEM_LOG: "1" },
  });
  const got = r.status === 2 ? "BLOQ" : r.status === 0 ? "OK" : "ERR" + r.status;
  const ok = got === esp;
  if (!ok) falhas++;
  console.log(`${ok ? "OK  " : "ERRO"} ${got === "BLOQ" ? "BLOQUEADO" : "liberado "}  ${cmd}`);
  if (got === "BLOQ" && process.argv[2] === "-v") console.log("   " + r.stderr.trim().replace(/\n/g, "\n   "));
}
console.log(falhas ? `\n${falhas} teste(s) com resultado errado` : `\nTodos os ${casos.length} testes deram o resultado esperado.`);
process.exit(falhas ? 1 : 0);
