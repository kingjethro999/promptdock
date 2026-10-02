(() => {
  const updates = window.PROMPTDOCK_UPDATES || [];
  const key = "promptdock.updates.read.v1";
  const params = new URLSearchParams(window.location.search);
  const requested =
    window.location.pathname.match(/^\/updates\/([^/]+)/)?.[1] ||
    params.get("id");
  const read = new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  const list = document.getElementById("updatesList");
  const esc = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const mark = (id) => {
    read.add(id);
    localStorage.setItem(key, JSON.stringify([...read]));
  };
  const render = () => {
    const items = requested
      ? updates.filter((item) => item.id === requested)
      : updates;
    if (!items.length) {
      list.innerHTML =
        "<p>That update could not be found. <a href='/updates'>See all updates.</a></p>";
      return;
    }
    if (requested) document.title = `${items[0].title} — PromptDock`;
    list.innerHTML = items
      .map(
        (item) =>
          `<article class="update-card ${read.has(item.id) ? "is-read" : ""}"><div><span class="update-meta">${esc(item.version)} · ${esc(item.date)}</span><h2>${esc(item.title)}</h2><p>${esc(requested ? item.body : item.summary)}</p></div><div class="update-card-actions"><button class="update-read-button ${read.has(item.id) ? "is-read" : ""}" type="button" data-read="${esc(item.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg><span>${read.has(item.id) ? "Read" : "Mark read"}</span></button>${!requested ? `<a class="update-card-link" href="/updates/${encodeURIComponent(item.id)}">Read update ↗</a>` : ""}</div></article>`,
      )
      .join("");
    list.querySelectorAll("[data-read]").forEach((button) =>
      button.addEventListener("click", () => {
        mark(button.dataset.read);
        render();
      }),
    );
  };
  render();
})();
