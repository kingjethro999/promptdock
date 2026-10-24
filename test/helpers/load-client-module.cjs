const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Execute real client modules with isolated browser/HTTP boundaries. Keep React,
// Zustand, serialization and application helpers real rather than mocking state.
function createClientLoader(globals = {}) {
  const root = path.resolve(__dirname, "../..");
  const cache = new Map();
  const context = vm.createContext({
    console,
    URL,
    Blob,
    File,
    Error,
    crypto: globalThis.crypto,
    setTimeout,
    clearTimeout,
    ...globals,
  });
  function load(filename) {
    const resolved = path.resolve(root, filename);
    const file = [
      resolved,
      `${resolved}.ts`,
      `${resolved}.tsx`,
      `${resolved}.js`,
    ].find(
      (candidate) =>
        fs.existsSync(candidate) && fs.statSync(candidate).isFile(),
    );
    if (!file) throw new Error(`Module not found: ${resolved}`);
    if (cache.has(file)) return cache.get(file).exports;
    if (file.endsWith(".js")) return require(file);
    const module = { exports: {} };
    cache.set(file, module);
    const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    });
    const execute = vm.runInContext(
      `(function(require, module, exports) {${outputText}\n})`,
      context,
      { filename: file },
    );
    execute(
      (id) => {
        if (id.startsWith("@/"))
          return load(path.join(root, "src", id.slice(2)));
        if (id.startsWith("."))
          return load(path.resolve(path.dirname(file), id));
        return require(id);
      },
      module,
      module.exports,
    );
    return module.exports;
  }
  return load;
}

function memoryStorage() {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
}

module.exports = { createClientLoader, memoryStorage };
