import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const root = resolve(".");
const srcDir = join(root, "src");
const indexPath = join(root, "index.html");

function collectJavaScriptFiles(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap(entry => {
      const path = join(dir, entry.name);

      if (entry.isDirectory()) {
        return collectJavaScriptFiles(path);
      }

      return entry.isFile() && entry.name.endsWith(".js")
        ? [path]
        : [];
    })
    .sort();
}

const jsFiles = collectJavaScriptFiles(srcDir);

assert.ok(jsFiles.length > 0, "No se encontraron archivos JavaScript en src/.");

for (const file of jsFiles) {
  execFileSync(process.execPath, ["--check", file], {
    stdio: "inherit"
  });
}

const html = readFileSync(indexPath, "utf8");
const scriptSources = [...html.matchAll(/<script\s+src="([^"]+)"/g)]
  .map(match => match[1]);

for (const source of scriptSources) {
  if (!source.startsWith("src/")) {
    continue;
  }

  const file = join(root, source);
  assert.ok(
    statSync(file).isFile(),
    `El script referenciado por index.html no existe: ${source}`
  );
}

assert.equal(
  scriptSources.filter(source => source === "src/app-shell.js").length,
  1,
  "app-shell.js debe cargarse exactamente una vez."
);

assert.equal(
  scriptSources.filter(source => source === "src/materials-view.js").length,
  1,
  "materials-view.js debe cargarse exactamente una vez."
);

console.log(`OK: ${jsFiles.length} archivos JavaScript pasan la comprobación de sintaxis.`);
console.log(`OK: todas las referencias src/* de index.html apuntan a archivos existentes.`);
