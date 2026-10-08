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

assert.equal(
  scriptSources.filter(source => source === "src/songs-controller.js").length,
  1,
  "songs-controller.js debe cargarse exactamente una vez."
);

assert.equal(
  scriptSources.filter(source => source === "src/app-navigation.js").length,
  1,
  "app-navigation.js debe cargarse exactamente una vez."
);

assert.equal(
  scriptSources.filter(source => source === "src/rich-text-composer.js").length,
  1,
  "rich-text-composer.js debe cargarse exactamente una vez."
);

assert.equal(
  scriptSources.filter(source => source === "src/comments-general.js").length,
  1,
  "comments-general.js debe cargarse exactamente una vez."
);

const commentsViewPosition = html.indexOf('<script src="src/comments-view.js"></script>');
const commentsGeneralPosition = html.indexOf('<script src="src/comments-general.js"></script>');

assert.ok(
  commentsViewPosition >= 0 &&
  commentsGeneralPosition > commentsViewPosition,
  "comments-general.js debe cargarse después de comments-view.js."
);

assert.equal(
  scriptSources.filter(source => source === "src/proposals-content.js").length,
  1,
  "proposals-content.js debe cargarse exactamente una vez."
);

assert.equal(
  scriptSources.filter(source => source === "src/proposals-form-ui.js").length,
  1,
  "proposals-form-ui.js debe cargarse exactamente una vez."
);

assert.equal(
  scriptSources.filter(source => source === "src/songs-comparison.js").length,
  1,
  "songs-comparison.js debe cargarse exactamente una vez."
);

assert.equal(
  scriptSources.filter(source => source === "src/songs-detail.js").length,
  1,
  "songs-detail.js debe cargarse exactamente una vez."
);

assert.equal(
  scriptSources.filter(source => source === "src/materials-editor.js").length,
  1,
  "materials-editor.js debe cargarse exactamente una vez."
);

const materialsViewLoadPosition = html.indexOf('<script src="src/materials-view.js"></script>');
const materialsEditorPosition = html.indexOf('<script src="src/materials-editor.js"></script>');
const songsComparisonPosition2 = html.indexOf('<script src="src/songs-comparison.js"></script>');

assert.ok(
  materialsViewLoadPosition >= 0 &&
  materialsEditorPosition > materialsViewLoadPosition &&
  songsComparisonPosition2 > materialsEditorPosition,
  "El editor de Materiales debe cargarse después de su vista y antes de la comparación de canciones."
);

const songsDetailPosition = html.indexOf('<script src="src/songs-detail.js"></script>');
const songsControllerLoadPosition = html.indexOf('<script src="src/songs-controller.js"></script>');

assert.ok(
  songsControllerLoadPosition >= 0 &&
  songsDetailPosition > songsControllerLoadPosition,
  "El detalle de canciones debe cargarse después del controlador de canciones."
);

const songsComparisonPosition = html.indexOf('<script src="src/songs-comparison.js"></script>');
const songsControllerPosition = html.indexOf('<script src="src/songs-controller.js"></script>');

assert.ok(
  songsComparisonPosition >= 0 &&
  songsControllerPosition > songsComparisonPosition,
  "La comparación de canciones debe cargarse antes del controlador de canciones."
);

const proposalsViewPosition = html.indexOf('<script src="src/proposals-view.js"></script>');
const proposalsFormUiPosition = html.indexOf('<script src="src/proposals-form-ui.js"></script>');

assert.ok(
  proposalsViewPosition >= 0 &&
  proposalsFormUiPosition > proposalsViewPosition,
  "La interfaz del formulario de Propuestas debe cargarse después de proposals-view.js."
);

const composerPosition = html.indexOf('<script src="src/rich-text-composer.js"></script>');
const composerCommentsViewPosition = html.indexOf('<script src="src/comments-view.js"></script>');

assert.ok(
  composerPosition >= 0 &&
  composerCommentsViewPosition > composerPosition,
  "El compositor reutilizable debe cargarse antes de comments-view.js."
);

const stylesheetLinks = [...html.matchAll(/<link\s+[^>]*rel="stylesheet"[^>]*>/gi)].map(match => match[0]);

assert.equal(
  stylesheetLinks.filter(tag => tag.includes('href="src/styles.css"')).length,
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

const appShellPosition = html.indexOf('<script src="src/app-shell.js"></script>');
const materialsViewPosition = html.indexOf('<script src="src/materials-view.js"></script>');
const globalSongsControllerPosition = html.indexOf('<script src="src/songs-controller.js"></script>');

assert.ok(
  appShellPosition >= 0 &&
  materialsViewPosition > appShellPosition &&
  globalSongsControllerPosition > materialsViewPosition,
  "Los módulos del shell, materiales y canciones deben cargarse en ese orden."
);

console.log(`OK: ${jsFiles.length} archivos JavaScript pasan la comprobación de sintaxis.`);
console.log(`OK: todas las referencias src/* de index.html apuntan a archivos existentes.`);
