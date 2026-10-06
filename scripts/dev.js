const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { build } = require("./build-frontend");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "oldui");
const revisionFile = path.join(source, "dist", ".dev-revision");
let generation = 0;
let timer;

function rebuild() {
  try {
    build();
    fs.writeFileSync(revisionFile, String(++generation));
  } catch (error) {
    console.error(`Frontend build failed: ${error.message}`);
  }
}

rebuild();
const server = spawn(process.execPath, ["--watch", "oldui/server.js"], {
  cwd: root,
  env: { ...process.env, PROMPTDOCK_DEV: "1" },
  stdio: "inherit",
});
const watcher = fs.watch(source, (_event, filename) => {
  if (!filename || filename === "dist" || filename === ".dev-revision") return;
  clearTimeout(timer);
  timer = setTimeout(rebuild, 120);
});
const styleWatcher = fs.watch(path.join(source, "styles"), () => {
  clearTimeout(timer);
  timer = setTimeout(rebuild, 120);
});
function stop() {
  clearTimeout(timer);
  watcher.close();
  styleWatcher.close();
  server.kill("SIGTERM");
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", (code) => {
  watcher.close();
  styleWatcher.close();
  process.exitCode = code || 0;
});
