// Syntax-check de TODOS los .js de src/worker (hallazgo de auditoría: el paso
// "Syntax check" del CI solo cubría index.js; node --check no sigue imports,
// así que un error en chatData.js/idfPdfDoc.js solo lo atrapaba el dry-run).
// Recorre el directorio para que un módulo nuevo quede cubierto sin tocar esto.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const dir = "src/worker";
const archivos = readdirSync(dir).filter((f) => f.endsWith(".js")).sort();

if (archivos.length === 0) {
  console.error(`No se encontraron .js en ${dir}`);
  process.exit(1);
}

for (const archivo of archivos) {
  execFileSync(process.execPath, ["--check", join(dir, archivo)], { stdio: "inherit" });
}
console.log(`Sintaxis OK: ${archivos.length} archivos de ${dir} (${archivos.join(", ")})`);
