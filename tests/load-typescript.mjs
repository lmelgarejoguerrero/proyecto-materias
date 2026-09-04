import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const cache = new Map();

// Compile the actual production helpers in memory, using the project's TypeScript dependency.
// This keeps the regression suite usable on Node 20 without a second TS runner dependency.
export function loadTypeScript(relativePath) {
  const filename = resolve(root, relativePath);
  if (cache.has(filename)) return cache.get(filename).exports;
  const compiledModule = { exports: {} };
  cache.set(filename, compiledModule);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText;
  const require = (specifier) => {
    if (specifier.startsWith("@/")) return loadTypeScript(`src/${specifier.slice(2)}.ts`);
    if (specifier.startsWith(".")) return loadTypeScript(resolve(dirname(filename), `${specifier}.ts`));
    return nativeRequire(specifier);
  };
  new Function("require", "module", "exports", output)(require, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
