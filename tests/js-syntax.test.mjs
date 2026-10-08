import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import vm from "node:vm";
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

const loadedSourceFiles = new Set(
  scriptSources.filter(
    source => source.startsWith("src/") && source.endsWith(".js")
  )
);

const intentionallyUnloadedSourceFiles = new Set([
  "rehearsals-data.js"
]);

for (const file of jsFiles) {
  const relativeSource = "src/" + file.slice(srcDir.length + 1).replaceAll("\\", "/");

  if (intentionallyUnloadedSourceFiles.has(relativeSource.slice(4))) {
    continue;
  }

  assert.ok(
    loadedSourceFiles.has(relativeSource),
    relativeSource + " existe en src/ pero no está cargado por index.html."
  );
}

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
  "src/app-band.js",
  "src/songs-color.js",
  "src/app-auth.js",
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
  "src/app-shell.js",
  "src/app-band.js"
);

assertScriptBefore(
  html,
  "src/songs-filters.js",
  "src/songs-color.js"
);

assertScriptBefore(
  html,
  "src/songs-color.js",
  "src/songs-controller.js"
);

assertScriptBefore(
  html,
  "src/songs-color.js",
  "src/songs-detail.js"
);

const appShellSource = readFileSync(
  join(srcDir, "app-shell.js"),
  "utf8"
);
const songsColorSource = readFileSync(
  join(srcDir, "songs-color.js"),
  "utf8"
);

assert.doesNotMatch(
  appShellSource,
  /function\s+renderColorPicker\s*\(/,
  "app-shell.js no debe contener el selector de color de Canciones."
);
assert.match(
  songsColorSource,
  /function\s+renderColorPicker\s*\(/,
  "songs-color.js debe contener el selector de color de Canciones."
);

assertScriptBefore(
  html,
  "src/app-band.js",
  "src/app-auth.js"
);

const appAuthSource = readFileSync(
  join(srcDir, "app-auth.js"),
  "utf8"
);

assert.match(
  appAuthSource,
  /setTimeout\(\(\) => \{[\s\S]*void handleAuthSession\(session\);[\s\S]*\}, 0\);/,
  "El callback de autenticación debe diferir handleAuthSession para no hacer llamadas Supabase dentro del callback."
);

assert.match(
  appAuthSource,
  /data\?\.session[\s\S]*setTimeout\(\(\) => \{[\s\S]*handleAuthSession\(data\.session\)/,
  "El login debe usar la sesión devuelta por signInWithPassword para iniciar la aplicación."
);

assert.doesNotMatch(
  appAuthSource,
  /onAuthStateChange\([\s\S]*function\(event, session\) \{\s*void handleAuthSession\(session\);/,
  "El callback de autenticación no debe invocar handleAuthSession directamente."
);

const appBandSource = readFileSync(
  join(srcDir, "app-band.js"),
  "utf8"
);

assert.doesNotMatch(
  appShellSource,
  /function\s+loadCurrentBand\s*\(/,
  "app-shell.js no debe contener la gestión de la Banda actual."
);
assert.match(
  appBandSource,
  /function\s+loadCurrentBand\s*\(/,
  "app-band.js debe contener la gestión de la Banda actual."
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

function loadPureFunctions(sourcePath, functionNames) {
  const source = readFileSync(
    join(root, sourcePath),
    "utf8"
  );

  const exportsExpression = functionNames
    .map(name => name + ": " + name)
    .join(", ");

  const context = {};
  vm.runInNewContext(
    source +
      "\n" +
      "globalThis.__testExports = { " +
      exportsExpression +
      " };",
    context,
    { filename: sourcePath }
  );

  return context.__testExports;
}

const {
  parseDuration,
  formatDuration,
  normalizeText,
  uniqueSorted,
  normalizeBandInstruments,
  formatBandInstruments
} = loadPureFunctions(
  "src/utils.js",
  [
    "parseDuration",
    "formatDuration",
    "normalizeText",
    "uniqueSorted",
    "normalizeBandInstruments",
    "formatBandInstruments"
  ]
);

assert.equal(parseDuration("3:05"), 185);
assert.equal(parseDuration(" 90 "), 90);
assert.equal(parseDuration("2:70"), 190);
assert.equal(parseDuration(""), null);
assert.equal(parseDuration("abc"), null);

assert.equal(formatDuration(185), "3:05");
assert.equal(formatDuration(90), "1:30");
assert.equal(formatDuration(null), "—");
assert.equal(formatDuration("abc"), "—");

assert.equal(normalizeText("  Canto "), "canto");
assert.deepEqual(
  Array.from(uniqueSorted(["Guitarra", "voz", " guitarra ", "Voz", "Bajo"])),
  ["Bajo", "guitarra", "Voz"]
);

assert.deepEqual(
  Array.from(normalizeBandInstruments([
    "guitar",
    "voice",
    "guitar",
    "invalid",
    "voice"
  ])),
  ["guitar", "voice"]
);

assert.equal(
  formatBandInstruments(["guitar", "voice", "invalid"]),
  "🎸 Guitarra, 🎤 Voz"
);

const {
  normalizeSongGenres,
  formatSongGenres
} = loadPureFunctions(
  "src/songs-data.js",
  ["normalizeSongGenres", "formatSongGenres"]
);

assert.deepEqual(
  Array.from(normalizeSongGenres("Rock, Worship, rock,  Worship ")),
  ["Rock", "Worship"]
);

assert.deepEqual(
  Array.from(normalizeSongGenres(["Balada", " balada ", "", null, "Rock"])),
  ["Balada", "Rock"]
);

assert.equal(
  formatSongGenres(["Balada", " Rock ", "balada"]),
  "Balada, Rock"
);

