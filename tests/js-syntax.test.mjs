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

const appStateSource = readFileSync(
  join(srcDir, "app-state.js"),
  "utf8"
);

assert.match(
  appStateSource,
  /persistSession:\s*true/,
  "Supabase Auth debe persistir la sesión en el cliente."
);
assert.match(
  appStateSource,
  /autoRefreshToken:\s*true/,
  "Supabase Auth debe refrescar automáticamente la sesión."
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
  "src/app-dom.js",
  "src/app-shell.js",
  "src/app-band.js",
  "src/songs-color.js",
  "src/app-auth.js",
  "src/metronome.js",
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
  "src/app-navigation.js",
  "src/app-auth.js"
);

assertScriptBefore(
  html,
  "src/materials-formatting.js",
  "src/materials-view.js"
);

assertScriptBefore(
  html,
  "src/materials-formatting.js",
  "src/materials-editor.js"
);

assert.match(
  html,
  /id="materialBoldBtn"/,
  "El editor de Materiales debe incluir el botón de negrita."
);

assert.match(
  html,
  /id="materialParenthesesBtn"/,
  "El editor de Materiales debe incluir el botón de paréntesis."
);

assert.match(
  html,
  /id="materialBracketsBtn"/,
  "El editor de Materiales debe incluir el botón de corchetes."
);

assert.match(
  html,
  /id="materialSize1Btn"/,
  "El editor de Materiales debe incluir el primer tamaño de texto."
);

assert.match(
  html,
  /id="materialSize2Btn"/,
  "El editor de Materiales debe incluir el segundo tamaño de texto."
);

const materialFormattingSource = readFileSync(
  join(srcDir, "materials-formatting.js"),
  "utf8"
);

assert.match(
  materialFormattingSource,
  /BANDABASE_RICH_TEXT_V1:/,
  "El formato enriquecido de Materiales debe tener un formato persistente identificable."
);

assert.match(
  materialFormattingSource,
  /material-text-size-1/,
  "Debe existir el primer tamaño enriquecido."
);

assert.match(
  materialFormattingSource,
  /material-text-size-2/,
  "Debe existir el segundo tamaño enriquecido."
);

assert.match(
  materialFormattingSource,
  /<a\b/,
  "El formato enriquecido de Materiales debe conservar enlaces."
);

assert.match(
  materialFormattingSource,
  /createMaterialAutoLinkFragment/,
  "El editor de Materiales debe poder convertir URLs en enlaces."
);

const appNavigationSource = readFileSync(
  join(srcDir, "app-navigation.js"),
  "utf8"
);

assert.doesNotMatch(
  appNavigationSource,
  /handleAuthSession\(/,
  "app-navigation.js no debe iniciar directamente el flujo de autenticación."
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
  /data\?\.session[\s\S]*await handleAuthSession\(data\.session\)/,
  "El login debe usar directamente la sesión devuelta por signInWithPassword para iniciar la aplicación."
);

assert.match(
  appAuthSource,
  /event === "INITIAL_SESSION"[\s\S]*return;/,
  "El evento INITIAL_SESSION no debe competir con la recuperación explícita de sesión."
);

assert.match(
  appAuthSource,
  /supabaseClient\.auth\.getSession\(\)/,
  "La autenticación debe recuperar explícitamente la sesión persistida al iniciar la aplicación."
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

const noticePosition = html.indexOf('<div id="notice"></div>');
const appDomPosition = html.indexOf(scriptTagFor("src/app-dom.js"));

assert.ok(
  noticePosition >= 0 &&
  appDomPosition > noticePosition,
  "app-dom.js debe cargarse después de que exista el DOM de la aplicación."
);

assertScriptBefore(
  html,
  "src/app-dom.js",
  "src/rich-text-composer.js"
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

  const context = { URL };
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
  parseMetronomeMeter,
  getMetronomeBarQuarterNotes,
  getMetronomeGroupStartPositions,
  getMetronomeSubdivisionQuarterNotes,
  getMetronomeClickIntervalSeconds
} = loadPureFunctions(
  "src/metronome.js",
  [
    "parseMetronomeMeter",
    "getMetronomeBarQuarterNotes",
    "getMetronomeGroupStartPositions",
    "getMetronomeSubdivisionQuarterNotes",
    "getMetronomeClickIntervalSeconds"
  ]
);

const parsedMetronomeMeter =
  parseMetronomeMeter("6/8");

assert.equal(
  parsedMetronomeMeter?.numerator,
  6
);

assert.equal(
  parsedMetronomeMeter?.denominator,
  8
);

assert.equal(
  parseMetronomeMeter("11/8"),
  null
);

assert.equal(
  getMetronomeBarQuarterNotes("4/4"),
  4
);

assert.equal(
  getMetronomeBarQuarterNotes("6/8"),
  3
);

assert.deepEqual(
  Array.from(
    getMetronomeGroupStartPositions("6/8")
  ),
  [0, 1.5]
);

assert.deepEqual(
  Array.from(
    getMetronomeGroupStartPositions("7/8")
  ),
  [0, 1, 2]
);

assert.equal(
  getMetronomeSubdivisionQuarterNotes("quarter"),
  1
);

assert.equal(
  getMetronomeSubdivisionQuarterNotes("white"),
  2
);

assert.equal(
  getMetronomeSubdivisionQuarterNotes("eighth"),
  0.5
);

assert.equal(
  getMetronomeClickIntervalSeconds(120, "quarter"),
  0.5
);

assert.equal(
  getMetronomeClickIntervalSeconds(120, "white"),
  1
);

assert.equal(
  getMetronomeClickIntervalSeconds(120, "eighth"),
  0.25
);

const {
  isMaterialRichTextContent,
  materialRichTextHasMarkup,
  getMaterialAutoLinkUrl,
  serializeMaterialAutoLinkedText
} = loadPureFunctions(
  "src/materials-formatting.js",
  [
    "isMaterialRichTextContent",
    "materialRichTextHasMarkup",
    "getMaterialAutoLinkUrl",
    "serializeMaterialAutoLinkedText"
  ]
);

assert.equal(
  isMaterialRichTextContent(
    "BANDABASE_RICH_TEXT_V1:<strong>Verso</strong>"
  ),
  true
);

assert.equal(
  isMaterialRichTextContent(
    "Verso normal"
  ),
  false
);

assert.equal(
  materialRichTextHasMarkup(
    '<a href="https://www.youtube.com">YouTube</a>'
  ),
  true
);

assert.equal(
  materialRichTextHasMarkup(
    "Texto normal"
  ),
  false
);

assert.equal(
  serializeMaterialAutoLinkedText(
    "Mirá https://www.youtube.com/test."
  ),
  'Mirá <a href="https://www.youtube.com/test" target="_blank" rel="noopener noreferrer">https://www.youtube.com/test</a>.'
);

assert.equal(
  getMaterialAutoLinkUrl(
    "https://www.youtube.com/watch?v=abc"
  ),
  "https://www.youtube.com/watch?v=abc"
);

assert.equal(
  getMaterialAutoLinkUrl(
    "www.youtube.com/watch?v=abc"
  ),
  "https://www.youtube.com/watch?v=abc"
);

assert.equal(
  getMaterialAutoLinkUrl(
    "javascript:alert(1)"
  ),
  null
);

const materialEditorSource = readFileSync(
  join(srcDir, "materials-editor.js"),
  "utf8"
);

assert.match(
  materialEditorSource,
  /function\s+toggleMaterialTextSize\s*\(/,
  "Los tamaños de texto de Materiales deben poder alternarse."
);

assert.match(
  materialEditorSource,
  /currentSize[\s\S]*nextSize[\s\S]*currentSize\s*===/,
  "El segundo clic debe detectar el tamaño actualmente aplicado."
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


// Regression coverage for the WITH ORDINALITY migration.
const ordinalityMigrationPath = join(
  root,
  "supabase/migrations/20261008225003_fix_json_recordset_ordinality.sql"
);
const ordinalityMigration = readFileSync(
  ordinalityMigrationPath,
  "utf8"
);

for (const functionName of [
  "replace_material_blocks",
  "replace_comment_blocks",
  "replace_proposal_blocks",
  "replace_band_list_items"
]) {
  assert.match(
    ordinalityMigration,
    new RegExp("create\\s+or\\s+replace\\s+function\\s+public\\." + functionName + "\\b", "i"),
    functionName + " debe corregirse en la migración."
  );
}

assert.equal(
  (ordinalityMigration.match(/jsonb_array_elements\([\s\S]*?with ordinality/gi) || []).length,
  4,
  "Las cuatro RPC deben obtener la posición mediante jsonb_array_elements WITH ORDINALITY."
);
assert.doesNotMatch(
  ordinalityMigration,
  /jsonb_to_recordset[\s\S]{0,180}with ordinality/i,
  "La migración no debe conservar el patrón JSON recordset + WITH ORDINALITY inválido."
);
assert.match(
  ordinalityMigration,
  /revoke execute on function public\.replace_material_blocks\(uuid, jsonb\) from public, anon/i,
  "La corrección debe conservar el acceso restringido de la RPC de Materiales."
);

// Exercise the compensation routine with mocked persistence calls.
const materialSaveSource = readFileSync(
  join(srcDir, "materials-save.js"),
  "utf8"
);
const materialSaveCalls = [];
const materialSaveContext = {
  document: {
    getElementById() {
      return { addEventListener() {} };
    }
  },
  supabaseClient: {
    storage: {
      from(bucket) {
        materialSaveCalls.push(["storage.from", bucket]);
        return {
          async remove(paths) {
            materialSaveCalls.push(["storage.remove", [...paths]]);
            return { error: null };
          }
        };
      }
    }
  },
  deleteMaterialAttachment: async (_client, attachmentId) => {
    materialSaveCalls.push(["deleteAttachment", attachmentId]);
    return { error: null };
  },
  deleteMaterial: async (_client, materialId) => {
    materialSaveCalls.push(["deleteMaterial", materialId]);
    return { error: null };
  },
  updateMaterial: async (_client, materialId, patch) => {
    materialSaveCalls.push(["updateMaterial", materialId, patch]);
    return { error: null };
  },
  console,
  Set
};
vm.runInNewContext(
  materialSaveSource + "\nglobalThis.__materialSaveTest = { cleanupFailedMaterialSave, getMaterialSaveFailureNotice };",
  materialSaveContext,
  { filename: "src/materials-save.js" }
);

const newMaterialCleanupErrors =
  await materialSaveContext.__materialSaveTest.cleanupFailedMaterialSave({
    materialId: "new-material",
    wasNew: true,
    originalMaterial: null,
    createdAttachmentIds: ["attachment-1", "attachment-2"],
    uploadedStoragePaths: ["band/material/file-1.wav", "band/material/file-2.wav", "band/material/file-1.wav"]
  });

assert.deepEqual(Array.from(newMaterialCleanupErrors), []);
assert.deepEqual(
  materialSaveCalls.filter(call => call[0] === "storage.remove")[0],
  ["storage.remove", ["band/material/file-1.wav", "band/material/file-2.wav"]],
  "La compensación debe deduplicar rutas de almacenamiento antes de eliminarlas."
);
assert.deepEqual(
  materialSaveCalls.filter(call => call[0] === "deleteAttachment").map(call => call[1]),
  ["attachment-2", "attachment-1"],
  "La compensación debe eliminar únicamente los adjuntos nuevos en orden inverso."
);
assert.deepEqual(
  materialSaveCalls.filter(call => call[0] === "deleteMaterial"),
  [["deleteMaterial", "new-material"]],
  "Si falla un material nuevo, la compensación debe eliminar el registro incompleto."
);

materialSaveCalls.length = 0;
const editedMaterialCleanupErrors =
  await materialSaveContext.__materialSaveTest.cleanupFailedMaterialSave({
    materialId: "existing-material",
    wasNew: false,
    originalMaterial: { name: "Nombre anterior", content: "Texto anterior" },
    createdAttachmentIds: ["new-attachment"],
    uploadedStoragePaths: []
  });

assert.deepEqual(Array.from(editedMaterialCleanupErrors), []);
assert.deepEqual(
  materialSaveCalls.filter(call => call[0] === "updateMaterial"),
  [["updateMaterial", "existing-material", {
    name: "Nombre anterior",
    content: "Texto anterior"
  }]],
  "Si falla la edición, la compensación debe restaurar nombre y contenido previos."
);
assert.equal(
  materialSaveCalls.some(call => call[0] === "deleteMaterial"),
  false,
  "Un fallo editando no debe borrar el material preexistente."
);

assert.match(
  materialSaveSource,
  /uploadedStoragePaths\.push\(storagePath\)/,
  "Cada archivo nuevo debe rastrearse para limpiar si falla el guardado."
);
assert.ok(
  (materialSaveSource.match(/cleanupFailedMaterialSave\(\{/g) || []).length >= 4,
  "Los errores al registrar enlaces, subir archivos, registrar adjuntos y persistir bloques deben activar compensación."
);

assert.equal(
  materialSaveContext.__materialSaveTest.getMaterialSaveFailureNotice("Error original", []),
  "Error original Se revirtieron los cambios parciales."
);
