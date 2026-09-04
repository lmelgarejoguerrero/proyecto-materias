import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);

// Each test receives an isolated module graph, fake service clients and a fake environment.
export function createServerLoader(mocks = {}, globals = {}) {
  const cache = new Map();
  return function load(relativePath) {
    const filename = resolve(root, relativePath);
    if (cache.has(filename)) return cache.get(filename).exports;
    const compiledModule = { exports: {} };
    cache.set(filename, compiledModule);
    const output = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
      fileName: filename,
    }).outputText;
    const require = (specifier) => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return nativeRequire(specifier);
      const path = specifier.startsWith("@/")
        ? resolve(root, "src", specifier.slice(2))
        : resolve(dirname(filename), specifier);
      if (extname(path) === ".json") return JSON.parse(readFileSync(path, "utf8"));
      return load(extname(path) ? path : `${path}.ts`);
    };
    new Function("require", "module", "exports", ...Object.keys(globals), output)(
      require, compiledModule, compiledModule.exports, ...Object.values(globals),
    );
    return compiledModule.exports;
  };
}
