import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const target = join(process.cwd(), "node_modules", "parquetjs-lite", "gen-nodejs", "parquet_types.js");

if (!existsSync(target)) {
  process.exit(0);
}

const source = readFileSync(target, "utf8");
const patched = source.replace(/^([A-Za-z_][A-Za-z0-9_]*) = module\.exports\./gm, "var $1 = module.exports.");

if (patched !== source) {
  writeFileSync(target, patched);
  console.log("Patched parquetjs-lite generated globals for strict Worker runtime.");
}
