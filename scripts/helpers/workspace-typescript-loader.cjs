const ts = require("typescript");

module.exports = function workspaceTypescriptLoader(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
    fileName: this.resourcePath,
  }).outputText;
};
