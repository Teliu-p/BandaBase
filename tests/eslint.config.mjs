import globals from "globals";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const configDirectory = dirname(fileURLToPath(import.meta.url));
const root = join(configDirectory, "..");
const sourceDirectory = join(root, "src");

function collectJavaScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return collectJavaScriptFiles(path);
      return entry.isFile() && entry.name.endsWith(".js") ? [path] : [];
    });
}

// BandaBase uses classic script tags, so top-level declarations in one source
// file are available to the other source files. Collect only declarations at
// column zero; collecting function-local names would hide genuine no-undef bugs.
const sharedNames = new Set(["supabase"]);
const files = collectJavaScriptFiles(sourceDirectory);

for (const file of files) {
  const source = readFileSync(file, "utf8");

  for (const match of source.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) {
    sharedNames.add(match[1]);
  }

  for (const match of source.matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/gm)) {
    sharedNames.add(match[1]);
  }

  for (const match of source.matchAll(/^(?:const|let|var)\s*\{([^}]+)\}\s*=/gm)) {
    for (const binding of match[1].split(",")) {
      const name = binding.trim().split(":")[0].trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) sharedNames.add(name);
    }
  }

  for (const match of source.matchAll(/^window\.([A-Za-z_$][\w$]*)\s*=/gm)) {
    sharedNames.add(match[1]);
  }
}

const projectGlobals = Object.fromEntries(
  [...sharedNames].map(name => [name, "readonly"])
);

export default [
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...projectGlobals
      }
    },
    rules: {
      "no-undef": "error"
    }
  }
];
