(() => {
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(window.location.search);
  let mode = params.get("mode") || "login";
  let resetToken = params.get("reset") || "";
  let usernameTimer;

  async function apiJson(response) {
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("The site API returned an invalid response. Try again.");
    }
    if (!response.ok) throw new Error(result.error || "Could not continue.");
    return result;
  }

  function setMessage(id, message = "") {
    $(id).textContent = message;
  }

  function setMode(next, message = "") {
    mode = next;
    const copy =
      {
        login: [
          "Sign in",
          "Sign in to open your saved prompts on any device.",
          "Sign in",
          "Create account",
        ],
        register: [
          "Create your workspace",
          "We’ll email you a link to verify your address.",
          "Create account",
          "I have an account",
        ],
        forgot: [
          "Reset your password",
          "Enter your email and we’ll send a reset link.",
          "Send reset link",
          "Back to sign in",
        ],
        reset: [
          "Choose a new password",
          "Use at least 12 characters.",
          "Update password",
          "Back to sign in",
        ],
        "pending-verify": [
          "Check your inbox",
          "Open the verification link we sent you. You can request a new one below.",
          "Resend verification",
          "Back to sign in",
        ],
        "pending-reset": [
          "Check your inbox",
          "If this email has an account, a reset link is on its way.",
          "Send again",
          "Back to sign in",
        ],
        verifying: [
          "Verifying your email",
          "Please wait while we confirm your address.",
          "",
          "",
        ],
      }[mode] || null;
    if (!copy) return setMode("login");
    $("authTitle").textContent = copy[0];
    $("authDescription").textContent = copy[1];
    $("authPageSubmit").textContent = copy[2];
    $("authPageToggle").textContent = copy[3];
    const emailNeeded = !["reset", "verifying"].includes(mode);
    const passwordNeeded = ["login", "register", "reset"].includes(mode);
    const confirmNeeded = ["register", "reset"].includes(mode);
    const usernameNeeded = mode === "register";
    $("authPageEmailWrap").classList.toggle("hidden", !emailNeeded);
    $("authPageUsernameWrap").classList.toggle("hidden", !usernameNeeded);
    $("authPagePasswordWrap").classList.toggle("hidden", !passwordNeeded);
    $("authPageConfirmWrap").classList.toggle("hidden", !confirmNeeded);
    $("authPageForgot").classList.toggle("hidden", mode !== "login");
    $("authPageSubmit").classList.toggle("hidden", mode === "verifying");
    $("authPageToggle").classList.toggle("hidden", mode === "verifying");
    $("authPageLegal").classList.toggle("hidden", mode !== "register");
    $("authPageEmail").required = emailNeeded;
    $("authPagePassword").required = passwordNeeded;
    $("authPageConfirm").required = confirmNeeded;
    $("authPageUsername").required = usernameNeeded;
    $("authPagePassword").autocomplete =
      mode === "login" ? "current-password" : "new-password";
    if (mode !== "register") {
      $("authPageUsername").value = "";
      setMessage("authPageUsernameFeedback");
    } else {
      setMessage("authPageUsernameFeedback", "Choose a username to continue.");
    }
    $("authPagePassword").value = "";
    $("authPageConfirm").value = "";
    setMessage("authPageError");
    setMessage("authPageSuccess", message);
    document.title = `${copy[0]} — PromptDock`;
  }

  async function checkUsername() {
    const input = $("authPageUsername");
    const username = input.value.trim();
    clearTimeout(usernameTimer);
    if (!/^[A-Za-z0-9][A-Za-z0-9_]{2,23}$/.test(username)) {
      setMessage(
        "authPageUsernameFeedback",
        "Use 3–24 letters, numbers, or underscores; start with a letter or number.",
      );
      input.setAttribute("aria-invalid", "true");
      return false;
    }
    setMessage("authPageUsernameFeedback", "Checking username…");
    return new Promise((resolve) => {
      usernameTimer = setTimeout(async () => {
        try {
          const response = await fetch(
            `/api/auth/username-check?username=${encodeURIComponent(username)}`,
          );
          const result = await apiJson(response);
          const available = Boolean(result.available);
          setMessage(
            "authPageUsernameFeedback",
            available
              ? "Username is available."
              : "That username is taken. Try another.",
          );
          input.setAttribute("aria-invalid", String(!available));
          resolve(available);
        } catch (error) {
          setMessage(
            "authPageUsernameFeedback",
            error.message || "Username check is unavailable.",
          );
          input.setAttribute("aria-invalid", "true");
          resolve(false);
        }
      }, 280);
    });
  }

  async function submit(event) {
    event.preventDefault();
    const button = $("authPageSubmit");
    button.disabled = true;
    setMessage("authPageError");
    try {
      if (
        ["register", "reset"].includes(mode) &&
        $("authPagePassword").value !== $("authPageConfirm").value
      )
        throw new Error("Passwords do not match.");
      if (mode === "register" && !(await checkUsername()))
        throw new Error("Choose an available username to continue.");
      const route =
        { "pending-verify": "resend", "pending-reset": "forgot" }[mode] || mode;
      const body =
        mode === "reset"
          ? { token: resetToken, password: $("authPagePassword").value }
          : {
              email: $("authPageEmail").value.trim(),
              password: $("authPagePassword").value,
            };
      if (mode === "register") {
        body.username = $("authPageUsername").value.trim();
        const referralCode =
          sessionStorage.getItem("promptdock.inviteCode") ||
          params.get("invite");
        if (referralCode) body.referralCode = referralCode;
      }
      const response = await fetch(`/api/auth/${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const result = await apiJson(response);
      if (mode === "register" || mode === "pending-verify") {
        sessionStorage.removeItem("promptdock.inviteCode");
        setMode(
          "pending-verify",
          "Verification email sent. Check your inbox and spam folder.",
        );
      } else if (mode === "forgot" || mode === "pending-reset") {
        setMode(
          "pending-reset",
          "If this address has an account, a reset link has been sent.",
        );
      } else if (mode === "reset") {
        resetToken = "";
        setMode("login", "Password updated. Sign in with your new password.");
      } else {
        window.location.assign("/");
      }
      return result;
    } catch (error) {
      setMessage("authPageError", error.message || "Could not continue.");
    } finally {
      button.disabled = false;
    }
  }

  async function handleToken() {
    if (resetToken) return setMode("reset");
    const verify = params.get("verify");
    if (!verify) return setMode(mode);
    setMode("verifying");
    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verify }),
      });
      await apiJson(response);
      setMode("login", "Email verified. Sign in to open your workspace.");
    } catch (error) {
      setMode("login");
      setMessage("authPageError", error.message || "Verification failed.");
    }
  }

  $("authPageForm").addEventListener("submit", submit);
  $("authPageToggle").addEventListener("click", () =>
    setMode(mode === "login" ? "register" : "login"),
  );
  $("authPageForgot").addEventListener("click", () => setMode("forgot"));
  $("authPageUsername").addEventListener("input", () => {
    if (mode === "register") checkUsername();
  });
  document.querySelectorAll("[data-toggle-password]").forEach((button) =>
    button.addEventListener("click", () => {
      const input = $(button.dataset.togglePassword);
      input.type = input.type === "password" ? "text" : "password";
      button.textContent = input.type === "password" ? "Show" : "Hide";
    }),
  );
  fetch("/api/auth/me", { credentials: "same-origin" })
    .then((response) => response.json())
    .then((result) => {
      if (result.user) window.location.replace("/");
    })
    .catch(() => {});
  handleToken();
})();
