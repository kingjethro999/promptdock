(() => {
  let revision = null;
  let timer;
  async function check() {
    try {
      const response = await fetch("/__dev/revision", { cache: "no-store" });
      if (response.ok) {
        const next = await response.text();
        if (revision !== null && next !== revision) {
          location.reload();
          return;
        }
        revision = next;
      }
    } catch {
      // The server may be restarting after a source edit.
    }
    timer = setTimeout(check, 1000);
  }
  check();
  window.addEventListener("pagehide", () => clearTimeout(timer));
})();
