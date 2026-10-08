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

function scriptTagFor(source) {
  return '<script src="' + source + '"></script>';
}

function assertScriptLoadedOnce(scriptSources, source) {
  assert.equal(
    scriptSources.filter(item => item === source).length,
    1,
    source + " debe cargarse exactamente una vez."
  );
}

function assertScriptBefore(html, before, after) {
  const beforePosition = html.indexOf(scriptTagFor(before));
  const afterPosition = html.indexOf(scriptTagFor(after));

  assert.ok(
    beforePosition >= 0 &&
    afterPosition > beforePosition,
    before + " debe cargarse antes de " + after + "."
  );
}

const jsFiles = collectJavaScriptFiles(srcDir);

assert.ok(
  jsFiles.length > 0,
  "No se encontraron archivos JavaScript en src/."
);

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
    "El script referenciado por index.html no existe: " + source
  );
}

[
  "src/app-shell.js",
  "src/app-navigation.js",
  "src/styles.css",
  "src/rich-text-composer.js",
  "src/comments-general.js",
  "src/proposals-content.js",
  "src/proposals-form-ui.js",
  "src/songs-comparison.js",
  "src/songs-detail.js",
  "src/materials-editor.js"
].forEach(source => {
  if (source.endsWith(".js")) {
    assertScriptLoadedOnce(scriptSources, source);
  }
});

assertScriptBefore(
  html,
  "src/lists-view.js",
  "src/lists-form.js"
);

assertScriptBefore(
  html,
  "src/rich-text-composer.js",
  "src/comments-view.js"
);

assertScriptBefore(
  html,
  "src/comments-view.js",
  "src/comments-save.js"
);

assertScriptBefore(
  html,
  "src/comments-save.js",
  "src/comments-general.js"
);

assertScriptBefore(
  html,
  "src/comments-view.js",
  "src/comments-general.js"
);

assertScriptBefore(
  html,
  "src/proposals-content.js",
  "src/proposals-view.js"
);

assertScriptBefore(
  html,
  "src/proposals-view.js",
  "src/proposals-form-ui.js"
);

assertScriptBefore(
  html,
  "src/materials-view.js",
  "src/materials-editor.js"
);

assertScriptBefore(
  html,
  "src/materials-editor.js",
  "src/materials-save.js"
);


assertScriptBefore(
  html,
  "src/materials-editor.js",
  "src/songs-comparison.js"
);

assertScriptBefore(
  html,
  "src/songs-comparison.js",
  "src/songs-controller.js"
);

assertScriptBefore(
  html,
  "src/songs-controller.js",
  "src/songs-detail.js"
);

assertScriptBefore(
  html,
  "src/songs-detail.js",
  "src/app-navigation.js"
);

assert.equal(
  (html.match(/<link\s+[^>]*href="src\/styles\.css"[^>]*>/gi) || []).length,
  1,
  "styles.css debe cargarse exactamente una vez."
);

assert.equal(
  (html.match(/<style(?:\s+[^>]*)?>[\s\S]*?<\/style>/gi) || []).length,
  0,
  "index.html no debe contener bloques style inline."
);

assert.equal(
  (html.match(/<script>\s*[\s\S]*?<\/script>/g) || []).length,
  0,
  "index.html no debe contener scripts JavaScript inline."
);

assert.doesNotMatch(
  html,
  /<script>\s*<script\s+src=/i,
  "No debe haber etiquetas <script> anidadas."
);

console.log(
  "OK: " + jsFiles.length + " archivos JavaScript pasan la comprobación de sintaxis."
);
console.log(
  "OK: todas las referencias src/* de index.html apuntan a archivos existentes."
);
