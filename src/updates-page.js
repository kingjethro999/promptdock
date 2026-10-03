(() => {
  const updates = window.PROMPTDOCK_UPDATES || [];
  const params = new URLSearchParams(window.location.search);
  const requested =
    window.location.pathname.match(/^\/updates\/([^/]+)/)?.[1] ||
    params.get("id");
  let read = new Set();
  let canMarkRead = false;
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
  const mark = async (id) => {
    const response = await fetch(
      `/api/updates/${encodeURIComponent(id)}/read`,
      {
        method: "POST",
        credentials: "same-origin",
      },
    );
    if (response.status === 401) throw new Error("Sign in to save read state.");
    if (!response.ok) throw new Error("Could not save read state.");
    read.add(id);
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
          `<article class="update-card ${read.has(item.id) ? "is-read" : ""}"><div><span class="update-meta">${esc(item.version)} · ${esc(item.date)}</span><h2>${esc(item.title)}</h2><p>${esc(requested ? item.body : item.summary)}</p></div><div class="update-card-actions">${canMarkRead ? `<button class="update-read-button ${read.has(item.id) ? "is-read" : ""}" type="button" data-read="${esc(item.id)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg><span>${read.has(item.id) ? "Read" : "Mark read"}</span></button>` : ""}${!requested ? `<a class="update-card-link" href="/updates/${encodeURIComponent(item.id)}">Read update ↗</a>` : ""}</div></article>`,
      )
      .join("");
    list.querySelectorAll("[data-read]").forEach((button) =>
      button.addEventListener("click", () => {
        mark(button.dataset.read)
          .then(render)
          .catch((error) => {
            const notice = document.createElement("p");
            notice.textContent = error.message;
            notice.className = "updates-page-notice";
            list.prepend(notice);
          });
      }),
    );
  };
  fetch("/api/updates", { credentials: "same-origin" })
    .then((response) => response.json())
    .then((payload) => {
      if (Array.isArray(payload.updates))
        updates.splice(0, updates.length, ...payload.updates);
      read = new Set(Array.isArray(payload.readIds) ? payload.readIds : []);
      canMarkRead = payload.canMarkRead === true;
      render();
    })
    .catch(() => render());
})();
