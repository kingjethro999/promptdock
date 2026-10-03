(() => {
  const $ = (id) => document.getElementById(id);

  async function request(url, options) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Request failed.");
    return body;
  }

  function deny() {
    $("adminDenied").classList.remove("hidden");
    $("adminContent").classList.add("hidden");
  }

  function renderAnalytics(values) {
    const container = $("adminStats");
    container.replaceChildren();
    for (const [label, value] of Object.entries(values)) {
      const card = document.createElement("div");
      card.className = "admin-stat";
      const number = document.createElement("strong");
      number.textContent = String(value);
      const name = document.createElement("span");
      name.textContent = label.replaceAll("_", " ");
      card.append(number, name);
      container.append(card);
    }
  }

  function renderFeedback(items) {
    const container = $("feedbackList");
    container.replaceChildren();
    $("adminFeedbackCount").textContent =
      `${items.length} ${items.length === 1 ? "report" : "reports"}`;
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "admin-muted";
      empty.textContent = "No feedback yet.";
      container.append(empty);
      return;
    }
    for (const item of items) {
      const article = document.createElement("article");
      article.className = "admin-feedback-item";
      const heading = document.createElement("strong");
      heading.textContent = `${item.kind} · ${item.contactEmail || "No reply email"}`;
      const message = document.createElement("p");
      message.textContent = item.message;
      const date = document.createElement("small");
      date.textContent = new Date(item.createdAt).toLocaleString();
      article.append(heading, message, date);
      container.append(article);
    }
  }

  function updatePreview() {
    const version = $("updateVersion").value.trim() || "VERSION";
    const date = $("updateDate").value.trim() || "DATE";
    $("adminPreviewVersion").textContent = `${version} · ${date}`;
    $("adminPreviewTitle").textContent =
      $("updateTitle").value.trim() || "Your update headline";
    $("adminPreviewSummary").textContent =
      $("updateSummary").value.trim() ||
      "The short summary will appear here as you write.";
  }

  function renderManagedUpdates(items) {
    const container = $("adminPublishedList");
    container.replaceChildren();
    const managed = items.filter((item) => item.publishedAt);
    if (!managed.length) {
      const empty = document.createElement("p");
      empty.className = "admin-muted";
      empty.textContent = "Updates you publish will appear here.";
      container.append(empty);
      return;
    }
    for (const item of managed) {
      const row = document.createElement("div");
      row.className = "admin-published-item";
      const details = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = item.title;
      const version = document.createElement("small");
      version.textContent = item.version;
      details.append(title, version);
      const action = document.createElement("button");
      action.type = "button";
      action.textContent = "Remove";
      action.setAttribute("aria-label", `Remove ${item.title}`);
      let confirming = false;
      action.addEventListener("click", async () => {
        if (!confirming) {
          confirming = true;
          action.textContent = "Confirm?";
          action.classList.add("is-confirming");
          return;
        }
        action.disabled = true;
        try {
          await request(`/api/admin/updates/${encodeURIComponent(item.id)}`, {
            method: "DELETE",
          });
          await load();
        } catch (error) {
          action.disabled = false;
          action.textContent = error.message;
        }
      });
      row.append(details, action);
      container.append(row);
    }
  }

  async function load() {
    try {
      const me = await request("/api/admin/me");
      if (!me.admin) return deny();
      $("adminContent").classList.remove("hidden");
      const [analytics, feedback, updates] = await Promise.all([
        request("/api/admin/analytics"),
        request("/api/admin/feedback"),
        request("/api/updates"),
      ]);
      renderAnalytics(analytics.analytics);
      renderFeedback(feedback.feedback);
      renderManagedUpdates(updates.updates || []);
    } catch (error) {
      $("adminContent").classList.remove("hidden");
      $("adminStats").textContent = error.message;
    }
  }

  $("updateForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = Object.fromEntries(
      ["Id", "Version", "Date", "Title", "Summary", "Body"].map((field) => [
        field.toLowerCase(),
        $("update" + field).value.trim(),
      ]),
    );
    const feedback = $("updateFeedback");
    feedback.textContent = "Publishing…";
    try {
      await request("/api/admin/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      feedback.textContent =
        "Published. Users will see it on their next live update check.";
      event.target.reset();
      updatePreview();
      await load();
    } catch (error) {
      feedback.textContent = error.message;
    }
  });

  $("updateForm").addEventListener("input", updatePreview);
  updatePreview();

  load();
})();
