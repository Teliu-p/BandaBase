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
  return '<script src="' + source;
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

const materialsViewSource = readFileSync(
  join(srcDir, "materials-view.js"),
  "utf8"
);
const commentsViewSource = readFileSync(
  join(srcDir, "comments-view.js"),
  "utf8"
);

assert.match(
  materialsViewSource,
  /data-material-audio-load[\s\S]*createSignedUrl[\s\S]*player\.src\s*=\s*signedUrl/,
  "Materiales debe solicitar la URL del audio solo desde la acción explícita de reproducir."
);
assert.match(
  commentsViewSource,
  /data-comment-audio-load[\s\S]*createSignedUrl[\s\S]*player\.src\s*=\s*signedUrl/,
  "Comentarios debe solicitar la URL del audio solo desde la acción explícita de reproducir."
);
assert.doesNotMatch(
  materialsViewSource + commentsViewSource,
  /preload="metadata"|hydrate(?:Material|Comment)AudioPlayers/,
  "La carga anticipada de metadatos y las funciones de hidratación automática deben desaparecer."
);

const proposalsViewSource = readFileSync(
  join(srcDir, "proposals-view.js"),
  "utf8"
);
const proposalsContentSource = readFileSync(
  join(srcDir, "proposals-content.js"),
  "utf8"
);

assert.doesNotMatch(
  proposalsViewSource,
  /createSignedUrls\s*\(/,
  "Propuestas no debe generar de antemano URLs para todos los archivos."
);
assert.match(
  proposalsViewSource,
  /querySelectorAll\([\s\S]{0,100}\[data-open-proposal-attachment\][\s\S]*createSignedUrl\s*\(/,
  "Propuestas debe solicitar la URL firmada desde la acción explícita de abrir un archivo."
);
assert.match(
  proposalsContentSource,
  /data-open-proposal-attachment/,
  "Los adjuntos de archivos de Propuestas deben presentar un control para abrirlos bajo demanda."
);

const html = readFileSync(indexPath, "utf8");
const styles = readFileSync(join(root, "src", "styles.css"), "utf8");
assert.match(
  styles,
  /\.color-picker\.is-open \.color-palette\s*\{\s*display:\s*grid;/,
  "La gama de colores debe permanecer oculta hasta que se abra el selector."
);


assert.match(
  html,
  /<form id="songDetailForm">\s*<div class="form-grid song-detail-grid">/,
  "El formulario de canción debe tener una grilla responsive dedicada."
);
assert.match(
  styles,
  /\.song-detail-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*grid-template-areas:[^}]*"title title"[^}]*"duration bpm"[^}]*"artist artist"[^}]*"genre meter"/s,
  "En móvil, el formulario debe distribuir los campos en dos columnas cómodas."
);

assert.match(
  styles,
  /@media\s*\(orientation:\s*portrait\)[\s\S]*?grid-template-areas:\s*"title title"\s*"artist artist"\s*"genre genre"\s*"duration bpm"\s*"meter meter"/,
  "En móvil vertical, los campos deben seguir el orden Título, Artista, Género, Duración, BPM y Métrica."
);


assert.match(
  html,
  /^---\s+layout:\s*null\s+---/,
  "index.html debe procesarse con Jekyll para recibir el hash del commit publicado."
);
assert.match(
  html,
  /<meta name="bandabase-build" content="\{\{ site\.github\.build_revision \}\}">/,
  "index.html debe exponer el hash de la versión publicada."
);
assert.match(
  html,
  /src\/app-update\.js\?v=\{\{ site\.github\.build_revision \}\}/,
  "El comprobador de actualizaciones también debe cambiar de URL en cada commit."
);
assert.match(
  html,
  /src\/styles\.css\?v=\{\{ site\.github\.build_revision \}\}/,
  "La hoja de estilos debe tener una URL distinta por versión."
);

const versionJson = readFileSync(join(root, "version.json"), "utf8");
assert.match(
  versionJson,
  /"build_revision"\s*:\s*"\{\{ site\.github\.build_revision \}\}"/,
  "version.json debe publicar el hash del commit mediante Jekyll."
);

const scriptSources = [...html.matchAll(/<script\s+src="([^"]+)"/g)]
  .map(match => match[1].split("?")[0]);

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
assert.match(
  songsColorSource,
  /color-picker-toggle/,
  "El selector debe mostrar un único indicador compacto."
);
assert.match(
  songsColorSource,
  /container\.classList\.toggle/,
  "El indicador debe abrir y cerrar la paleta."
);
assert.match(
  songsColorSource,
  /color-palette/,
  "La gama completa debe estar dentro de una paleta desplegable."
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
  /id="materialItalicBtn"/,
  "El editor de Materiales debe incluir el botón de cursiva junto a negrita."
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

for (const buttonId of [
  "materialBoldBtn",
  "materialItalicBtn",
  "materialSize1Btn",
  "materialSize2Btn"
]) {
  const buttonStart = html.indexOf('id="' + buttonId + '"');
  const buttonEnd = html.indexOf(">", buttonStart);
  assert.ok(buttonStart >= 0 && buttonEnd > buttonStart);
  assert.match(
    html.slice(buttonStart, buttonEnd),
    /aria-pressed="false"/,
    buttonId + " debe exponer su estado activo a tecnologías de asistencia."
  );
}

const materialEditorStateSource = readFileSync(
  join(srcDir, "materials-editor.js"),
  "utf8"
);

assert.match(
  materialEditorStateSource,
  /function updateMaterialFormattingButtonStates\s*\(/,
  "El estado de los botones debe actualizarse según el formato de la selección."
);

assert.match(
  materialEditorStateSource,
  /isCommandActive\("bold"\)/,
  "Negrita debe reflejarse como activa cuando corresponda."
);

assert.match(
  materialEditorStateSource,
  /isCommandActive\("italic"\)/,
  "Cursiva debe reflejarse como activa cuando corresponda."
);

assert.match(
  materialEditorStateSource,
  /classList\.add\(\s*"is-action-feedback"/,
  "Los botones de inserción de símbolos deben ofrecer feedback visual tras usarlos."
);

assert.match(
  styles,
  /\.material-format-btn\.is-active[\s\S]*?\.material-format-btn\.is-action-feedback/,
  "Los estados activos y el feedback de inserción deben distinguirse visualmente."
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
  /material-text-size-normal/,
  "Debe existir un formato de tamaño normal que permita deshacer A+ o A++ dentro de otro tamaño sin perder el tamaño base."
);

const {
  calculateMaterialForcedCaretPadding
} = loadPureFunctions(
  "src/materials-formatting.js",
  ["calculateMaterialForcedCaretPadding"]
);

const sameLineCaretPadding =
  calculateMaterialForcedCaretPadding(
    40, 30, 110, 30, 22, 6, 10
  );

assert.equal(sameLineCaretPadding.lineBreaks, 0);
assert.equal(
  sameLineCaretPadding.spaces,
  12,
  "El doble clic después del texto debe insertar espacios hasta aproximar el punto elegido."
);

const lowerBlankLinePadding =
  calculateMaterialForcedCaretPadding(
    40, 30, 58, 74, 22, 6, 10
  );

assert.equal(
  lowerBlankLinePadding.lineBreaks,
  2,
  "El doble clic varias líneas debajo debe crear las líneas vacías necesarias."
);
assert.equal(
  lowerBlankLinePadding.spaces,
  8,
  "Después de crear líneas vacías, la posición horizontal debe medirse desde el inicio del texto."
);

const caretAboveClickPadding =
  calculateMaterialForcedCaretPadding(
    40, 74, 58, 30, 22, 6, 10
  );

assert.equal(
  caretAboveClickPadding.lineBreaks,
  0,
  "Una diferencia vertical negativa no debe eliminar texto ni insertar saltos."
);

const {
  getNextMaterialTextSizeClass
} = loadPureFunctions(
  "src/materials-formatting.js",
  ["getNextMaterialTextSizeClass"]
);

assert.equal(
  getNextMaterialTextSizeClass(null, "material-text-size-1"),
  "material-text-size-1"
);
assert.equal(
  getNextMaterialTextSizeClass("material-text-size-1", "material-text-size-1"),
  "material-text-size-normal",
  "Pulsar el mismo tamaño debe volver al tamaño normal en lugar de crear otro envoltorio."
);
assert.equal(
  getNextMaterialTextSizeClass("material-text-size-normal", "material-text-size-1"),
  "material-text-size-1"
);
assert.equal(
  getNextMaterialTextSizeClass("material-text-size-1", "material-text-size-2"),
  "material-text-size-2",
  "Cambiar de A+ a A++ debe reemplazar el tamaño existente."
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

assert.match(
  materialFormattingSource,
  /node\.tagName === "I"\s*\|\|\s*node\.tagName === "EM"/,
  "El formato enriquecido debe reconocer cursiva al guardar, restaurar y mostrar."
);

assert.ok(
  materialFormattingSource.includes('/<(?:strong|em|a)\\b|<span\\b'),
  "La detección del formato enriquecido debe reconocer cursiva y tamaños de texto."
);

assert.ok(
  materialFormattingSource.includes('"<em>" +') &&
  materialFormattingSource.includes('"</em>"'),
  "La cursiva debe guardarse como marcado enriquecido seguro."
);

const materialEditorFormattingSource = readFileSync(
  join(srcDir, "materials-editor.js"),
  "utf8"
);

assert.match(
  materialEditorFormattingSource,
  /function restoreMaterialSelection\(\s*rangeToRestore = materialSelectionRange/,
  "La restauración debe aceptar una copia de la selección, sin depender de un estado que el evento focus pueda sobrescribir."
);

assert.match(
  materialEditorFormattingSource,
  /addEventListener\(\s*"dblclick",\s*placeMaterialCaretAtDoubleClick/,
  "La posición especial debe activarse con doble clic, sin alterar el clic simple."
);

assert.match(
  materialEditorFormattingSource,
  /caretPositionFromPoint[\s\S]*?caretRangeFromPoint/,
  "El doble clic debe consultar la posición real del cursor con las API de coordenadas del navegador."
);

assert.match(
  materialEditorFormattingSource,
  /hasMaterialTextAtOrAfterPointOnLine\([\s\S]*?padding\.spaces/,
  "Al hacer doble clic sobre texto existente, el editor no debe insertar espacios por el mero hecho de que la posición de cursor quede dentro de un carácter."
);

assert.match(
  materialEditorFormattingSource,
  /"\\n"\.repeat\(\s*padding\.lineBreaks\s*\)/,
  "El doble clic en una zona vacía inferior debe crear saltos de línea hasta el renglón solicitado."
);

assert.match(
  materialEditorFormattingSource,
  /function focusMaterialEditorForFormatting\(\)[\s\S]*?const savedRange =\s*materialSelectionRange\?\.cloneRange\(\) \|\| null;[\s\S]*?editor\.focus\(\);[\s\S]*?restoreMaterialSelection\(savedRange\)/,
  "El formato debe conservar la selección original antes de devolver el foco al editor."
);

assert.match(
  materialEditorFormattingSource,
  /fragment\.appendChild\(\s*closing\s*\);[\s\S]*?range\.insertNode\(\s*fragment\s*\);[\s\S]*?range\.setStartAfter\(\s*closing\s*\)/,
  "Tras encerrar una selección, el cursor debe quedar después del cierre para que el siguiente formato no se aplique al rango equivocado."
);

assert.match(
  materialEditorFormattingSource,
  /executeMaterialTextCommand\([\s\S]{0,80}"italic"/,
  "El botón de cursiva debe ejecutar la orden de formato italic."
);

assert.match(
  materialEditorFormattingSource,
  /function getMaterialTextSizeElementForRange\([\s\S]*?exactContentsOnly = false[\s\S]*?selectedText === element\.textContent/,
  "El editor debe reconocer el tamaño propio ya aplicado al texto seleccionado después de guardar y volver a abrir."
);

assert.match(
  materialEditorFormattingSource,
  /function toggleMaterialTextSize\([\s\S]*?const exactSizeElement[\s\S]*?clearMaterialTextSizeDescendants\([\s\S]*?wrapper\.className =\s*nextClass/,
  "Al volver a aplicar un tamaño sobre la misma selección, debe reutilizar el envoltorio existente."
);

assert.match(
  materialEditorFormattingSource,
  /range\.extractContents\(\)[\s\S]*?clearMaterialTextSizeDescendants\([\s\S]*?wrapper\.className =\s*nextClass/,
  "Al cambiar el tamaño de una selección parcial, debe eliminar los tamaños heredados del fragmento antes de envolverlo."
);

assert.match(
  styles,
  /\.material-text-size-normal[\s\S]*?font-size:\s*1rem/,
  "El tamaño normal debe restablecer una medida base, incluso dentro de una selección previamente ampliada."
);

assert.match(
  styles,
  /\.material-text-size-1[\s\S]*?font-size:\s*1\.25rem[\s\S]*?\.material-text-size-2[\s\S]*?font-size:\s*1\.5rem/,
  "A+ y A++ deben usar medidas basadas en la raíz para que los tamaños anidados no se multipliquen."
);

assert.doesNotMatch(
  styles,
  /font-size:\s*1\.25em|font-size:\s*1\.5em/,
  "Los tamaños de Materiales no deben escalar multiplicándose con el tamaño heredado."
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
  (html.match(/<link\s+[^>]*href="src\/styles\.css(?:\?[^"]*)?"[^>]*>/gi) || []).length,
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
  serializeMaterialAutoLinkedText,
  renderMaterialRichTextTextNode
} = loadPureFunctions(
  "src/materials-formatting.js",
  [
    "isMaterialRichTextContent",
    "materialRichTextHasMarkup",
    "getMaterialAutoLinkUrl",
    "serializeMaterialAutoLinkedText",
    "renderMaterialRichTextTextNode"
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
  materialRichTextHasMarkup(
    '<span class="material-text-size-1">Texto grande</span>'
  ),
  true,
  "El tamaño de texto debe persistir incluso cuando está aplicado sin negrita o cursiva."
);

assert.equal(
  materialRichTextHasMarkup(
    '<span class="material-text-size-2"><em><strong>Texto combinado</strong></em></span>'
  ),
  true,
  "La combinación de tamaño, cursiva y negrita debe conservar el formato enriquecido."
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

assert.equal(
  getMaterialAutoLinkUrl(
    "data:text/html,<script>alert(1)</script>"
  ),
  null
);
assert.equal(
  getMaterialAutoLinkUrl(
    "file:///etc/passwd"
  ),
  null
);
assert.equal(
  getMaterialAutoLinkUrl(
    "ftp://example.com/resource"
  ),
  null
);

assert.equal(
  renderMaterialRichTextTextNode(
    "Texto y https://www.youtube.com/watch?v=ejemplo."
  ),
  'Texto y <a href="https://www.youtube.com/watch?v=ejemplo" target="_blank" rel="noopener noreferrer">https://www.youtube.com/watch?v=ejemplo</a>.'
);
assert.equal(
  renderMaterialRichTextTextNode(
    "https://www.youtube.com/watch?v=ejemplo",
    true
  ),
  "https://www.youtube.com/watch?v=ejemplo",
  "El texto dentro de un enlace existente no debe generar un enlace anidado."
);
assert.equal(
  renderMaterialRichTextTextNode(
    "Texto <script>alert(1)</script>",
    true
  ),
  "Texto &lt;script&gt;alert(1)&lt;/script&gt;",
  "El texto dentro de enlaces debe seguir escapándose como HTML."
);
assert.equal(
  renderMaterialRichTextTextNode(
    "Primero\nhttps://example.com/video"
  ),
  'Primero<br><a href="https://example.com/video" target="_blank" rel="noopener noreferrer">https://example.com/video</a>'
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
const materialRestoreCalls = materialSaveCalls.filter(
  call => call[0] === "updateMaterial"
);
assert.equal(materialRestoreCalls.length, 1);
assert.equal(materialRestoreCalls[0][1], "existing-material");
assert.equal(materialRestoreCalls[0][2].name, "Nombre anterior");
assert.equal(materialRestoreCalls[0][2].content, "Texto anterior");
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

materialSaveContext.supabaseClient.storage.from = () => ({
  async remove() {
    throw new Error("storage unavailable");
  }
});
materialSaveContext.deleteMaterialAttachment = async () => {
  throw new Error("attachment delete unavailable");
};
materialSaveContext.deleteMaterial = async () => {
  throw new Error("material delete unavailable");
};

const incompleteCleanupErrors =
  await materialSaveContext.__materialSaveTest.cleanupFailedMaterialSave({
    materialId: "failed-new-material",
    wasNew: true,
    originalMaterial: null,
    createdAttachmentIds: ["failed-attachment"],
    uploadedStoragePaths: ["band/material/failed.wav"]
  });

assert.equal(
  incompleteCleanupErrors.length,
  3,
  "La compensación debe seguir con los siguientes pasos incluso si almacenamiento o eliminación de registros falla."
);
assert.ok(
  incompleteCleanupErrors.some(message => message.includes("storage unavailable"))
);
assert.ok(
  incompleteCleanupErrors.some(message => message.includes("attachment delete unavailable"))
);
assert.ok(
  incompleteCleanupErrors.some(message => message.includes("material delete unavailable"))
);


// Simulate the complete save flow with a deterministic Supabase stub.
async function runMaterialSaveScenario(options = {}) {
  const calls = [];
  const notices = [];
  const originalMaterial = {
    id: "existing-material",
    name: "Título anterior",
    content: "Contenido anterior",
    attachments: options.existingAttachments || []
  };
  const pendingAttachments = options.pendingAttachments || {};
  let attachmentSequence = 1;
  const attachmentResponses = [...(options.attachmentResponses || [])];
  const materialId = options.existing ? originalMaterial.id : "new-material";
  const storage = {
    from(bucket) {
      return {
        async upload(path, file) {
          calls.push(["upload", bucket, path, file.name]);
          return options.uploadError
            ? { error: { message: options.uploadError } }
            : { error: null };
        },
        async remove(paths) {
          calls.push(["removeStorage", bucket, [...paths]]);
          return options.removeStorageError
            ? { error: { message: options.removeStorageError } }
            : { error: null };
        }
      };
    }
  };
  const context = {
    currentBand: { id: "band-1" },
    currentSong: { id: "song-1" },
    currentUser: { id: "user-1" },
    editingMaterialId: options.existing ? materialId : null,
    currentMaterials: options.existing ? [originalMaterial] : [],
    materialDraftInitialAttachmentIds: new Set(
      (options.existingAttachments || []).map(attachment => attachment.id)
    ),
    materialPendingAttachments: pendingAttachments,
    openMaterialIds: new Set(),
    supabaseClient: { storage },
    crypto: { randomUUID: () => "test-uuid" },
    document: {
      getElementById(id) {
        if (id === "materialName") {
          return { value: options.name || "Material de prueba" };
        }
        return { addEventListener() {} };
      }
    },
    collectMaterialComposerBlocks: () => options.blocks || [
      { block_type: "text", content: "Texto de prueba" }
    ],
    collectMaterialLegacyText: blocks => blocks
      .filter(block => block.block_type === "text")
      .map(block => block.content || "")
      .join("\\n\\n")
      .trim(),
    createMaterial: async (_client, data) => {
      calls.push(["createMaterial", data]);
      return { data: { id: materialId }, error: null };
    },
    updateMaterial: async (_client, id, data) => {
      calls.push(["updateMaterial", id, data]);
      return options.updateError
        ? { error: { message: options.updateError } }
        : { error: null };
    },
    createMaterialAttachment: async (_client, data) => {
      calls.push(["createAttachment", data]);
      if (attachmentResponses.length) {
        return attachmentResponses.shift();
      }
      const id = "attachment-" + attachmentSequence++;
      return { data: { id }, error: null };
    },
    deleteMaterialAttachment: async (_client, id) => {
      calls.push(["deleteAttachment", id]);
      return options.deleteAttachmentError
        ? { error: { message: options.deleteAttachmentError } }
        : { error: null };
    },
    deleteMaterial: async (_client, id) => {
      calls.push(["deleteMaterial", id]);
      return options.deleteMaterialError
        ? { error: { message: options.deleteMaterialError } }
        : { error: null };
    },
    replaceMaterialBlocks: async (_client, id, blocks) => {
      calls.push(["replaceBlocks", id, blocks]);
      return options.blocksError
        ? { error: { message: options.blocksError } }
        : { error: null };
    },
    sanitizeStorageFileName: name => name.replaceAll(" ", "_"),
    showNotice: (message, type) => notices.push([message, type]),
    hideMaterialForm: () => calls.push(["hideForm"]),
    loadMaterials: async () => calls.push(["loadMaterials"]),
    console,
    Set
  };

  vm.runInNewContext(
    materialSaveSource + "\nglobalThis.__runMaterialSaveTest = saveMaterialDraft;",
    context,
    { filename: "src/materials-save.js" }
  );

  await context.__runMaterialSaveTest();
  return { calls, notices, originalMaterial };
}

const fileBlocks = [
  { block_type: "text", content: "Antes del archivo" },
  { block_type: "attachment", pendingKey: "pending-file" },
  { block_type: "text", content: "Entre los recursos" },
  { block_type: "attachment", pendingKey: "pending-link" },
  { block_type: "text", content: "Después del enlace" }
];
const successSave = await runMaterialSaveScenario({
  blocks: fileBlocks,
  pendingAttachments: {
    "pending-file": {
      kind: "file",
      file: { name: "ensayo audio.wav", type: "audio/wav" }
    },
    "pending-link": {
      kind: "link",
      name: "Video de referencia",
      url: "https://www.youtube.com/watch?v=ejemplo"
    }
  }
});
const successPersistedBlocks = successSave.calls.find(
  call => call[0] === "replaceBlocks"
)[2];
assert.equal(successPersistedBlocks.length, 5);
assert.deepEqual(
  Array.from(successPersistedBlocks, block => block.position),
  [0, 1, 2, 3, 4],
  "Texto, archivo y enlace deben conservar el orden de composición."
);
assert.deepEqual(
  Array.from(successPersistedBlocks, block => block.block_type),
  ["text", "attachment", "text", "attachment", "text"]
);
assert.equal(
  successSave.calls.filter(call => call[0] === "createAttachment").length,
  2,
  "El guardado normal debe registrar tanto el archivo como el enlace."
);
assert.equal(
  successSave.calls.some(call => call[0] === "removeStorage" || call[0] === "deleteMaterial"),
  false,
  "Una operación exitosa no debe activar la compensación."
);
assert.deepEqual(successSave.notices, [["Material agregado.", "success"]]);

const newSaveRollback = await runMaterialSaveScenario({
  blocks: [
    { block_type: "text", content: "Texto antes" },
    { block_type: "attachment", pendingKey: "pending-file" },
    { block_type: "text", content: "Texto después" }
  ],
  pendingAttachments: {
    "pending-file": {
      kind: "file",
      file: { name: "archivo.wav", type: "audio/wav" }
    }
  },
  blocksError: "WITH ORDINALITY cannot be used with a column definition list"
});
assert.ok(newSaveRollback.calls.some(call => call[0] === "removeStorage"));
assert.deepEqual(
  newSaveRollback.calls.filter(call => call[0] === "deleteAttachment").map(call => call[1]),
  ["attachment-1"]
);
assert.deepEqual(
  newSaveRollback.calls.filter(call => call[0] === "deleteMaterial"),
  [["deleteMaterial", "new-material"]]
);
assert.match(newSaveRollback.notices[0][0], /Se revirtieron los cambios parciales/);
assert.equal(
  newSaveRollback.calls.some(call => call[0] === "loadMaterials"),
  false,
  "No debe recargarse como exitoso un material nuevo cuyo reemplazo de bloques falló."
);

const editSaveRollback = await runMaterialSaveScenario({
  existing: true,
  blocks: [
    { block_type: "text", content: "Contenido editado" },
    { block_type: "attachment", pendingKey: "pending-file" }
  ],
  pendingAttachments: {
    "pending-file": {
      kind: "file",
      file: { name: "archivo nuevo.wav", type: "audio/wav" }
    }
  },
  blocksError: "RPC failure"
});
assert.equal(
  editSaveRollback.calls.some(call => call[0] === "deleteMaterial"),
  false,
  "Un fallo editando nunca debe eliminar el material existente."
);
const editRestore = editSaveRollback.calls.filter(call => call[0] === "updateMaterial").at(-1);
assert.equal(editRestore[1], "existing-material");
assert.equal(editRestore[2].name, "Título anterior");
assert.equal(editRestore[2].content, "Contenido anterior");
assert.equal(
  editSaveRollback.calls.filter(call => call[0] === "deleteAttachment").length,
  1,
  "Solo se debe limpiar el adjunto creado por el intento fallido."
);

const uploadFailureRollback = await runMaterialSaveScenario({
  blocks: [
    { block_type: "attachment", pendingKey: "pending-file" }
  ],
  pendingAttachments: {
    "pending-file": {
      kind: "file",
      file: { name: "fallará.wav", type: "audio/wav" }
    }
  },
  uploadError: "upload rejected"
});
assert.ok(
  uploadFailureRollback.calls.some(call => call[0] === "removeStorage"),
  "Un fallo al subir debe intentar eliminar cualquier objeto parcial."
);
assert.equal(
  uploadFailureRollback.calls.some(call => call[0] === "createAttachment"),
  false
);
assert.ok(
  uploadFailureRollback.calls.some(call => call[0] === "deleteMaterial"),
  "El material nuevo debe borrarse si la subida falla."
);

const partialLinkFailureRollback = await runMaterialSaveScenario({
  blocks: [
    { block_type: "attachment", pendingKey: "pending-file" },
    { block_type: "attachment", pendingKey: "pending-link" }
  ],
  pendingAttachments: {
    "pending-file": {
      kind: "file",
      file: { name: "primero.wav", type: "audio/wav" }
    },
    "pending-link": {
      kind: "link",
      name: "Link roto",
      url: "https://example.com"
    }
  },
  attachmentResponses: [
    { data: { id: "first-file-attachment" }, error: null },
    { data: null, error: { message: "link record rejected" } }
  ]
});
assert.ok(partialLinkFailureRollback.calls.some(call => call[0] === "removeStorage"));
assert.deepEqual(
  partialLinkFailureRollback.calls.filter(call => call[0] === "deleteAttachment").map(call => call[1]),
  ["first-file-attachment"]
);
assert.ok(
  partialLinkFailureRollback.calls.some(call => call[0] === "deleteMaterial"),
  "Si falla el enlace después de subir un archivo, también deben limpiarse los pasos anteriores."
);
assert.equal(
  partialLinkFailureRollback.calls.some(call => call[0] === "replaceBlocks"),
  false,
  "No se debe persistir la secuencia si falló el registro de uno de sus recursos."
);


const failedOldFileCleanup = await runMaterialSaveScenario({
  existing: true,
  blocks: [{ block_type: "text", content: "Texto conservado" }],
  existingAttachments: [{
    id: "old-file-attachment",
    kind: "file",
    name: "archivo anterior.wav",
    storage_path: "band-1/existing-material/old-file.wav"
  }],
  removeStorageError: "storage temporarily unavailable"
});
assert.ok(
  failedOldFileCleanup.calls.some(call => call[0] === "removeStorage"),
  "La limpieza debe intentar quitar archivos viejos que ya no aparecen en los bloques."
);
assert.equal(
  failedOldFileCleanup.calls.some(
    call => call[0] === "deleteAttachment" && call[1] === "old-file-attachment"
  ),
  false,
  "Si falla la eliminación del objeto, debe conservarse su registro para reintentar y no perder la ruta."
);
assert.match(
  failedOldFileCleanup.notices.at(-1)[0],
  /se conservaron sus registros para reintentar la limpieza/,
  "El aviso final debe informar que la actualización se guardó pero la limpieza quedó pendiente."
);
assert.equal(
  failedOldFileCleanup.notices.at(-1)[1],
  "error"
);
