(function () {
  function renderApiKeyBanner() {
    const mount = document.getElementById("apiKeyBanner");
    if (!mount) return;

    const savedKey = sessionStorage.getItem("oai_key") || "";
    mount.innerHTML = `
      <div class="api-banner">
        <div class="api-banner-copy">
          <strong>OpenAI API Key</strong>
          <div class="api-banner-status" id="apiKeyStatus">
            ${savedKey ? "Session key loaded. AI analysis will use the current browser session key." : "No session key saved. The app will fall back to the local estimator until one is provided."}
          </div>
        </div>
        <div class="field-group">
          <label for="sessionApiKeyInput">Session-only key</label>
          <input
            type="password"
            id="sessionApiKeyInput"
            placeholder="sk-..."
            value="${savedKey}"
            autocomplete="off"
            spellcheck="false"
          />
        </div>
        <button class="secondary-btn" id="saveApiKeyBtn">Save Key</button>
        <button class="ghost-btn" id="clearApiKeyBtn">Clear Key</button>
      </div>
    `;

    const input = document.getElementById("sessionApiKeyInput");
    const status = document.getElementById("apiKeyStatus");

    document.getElementById("saveApiKeyBtn").addEventListener("click", () => {
      const value = input.value.trim();
      if (value) {
        sessionStorage.setItem("oai_key", value);
        status.textContent = "Session key loaded. AI analysis will use the current browser session key.";
      } else {
        sessionStorage.removeItem("oai_key");
        status.textContent = "No session key saved. The app will fall back to the local estimator until one is provided.";
      }
    });

    document.getElementById("clearApiKeyBtn").addEventListener("click", () => {
      input.value = "";
      sessionStorage.removeItem("oai_key");
      status.textContent = "No session key saved. The app will fall back to the local estimator until one is provided.";
    });
  }

  function setOverlayHidden(hidden) {
    const overlay = document.getElementById("loadingOverlay");
    if (!overlay) return;
    overlay.classList.toggle("hidden", hidden);
  }

  function wireButtons() {
    const analyzeBtn = document.getElementById("analyzeBtn");
    const demoBtn = document.getElementById("demoBtn");

    if (analyzeBtn) {
      analyzeBtn.addEventListener("click", async () => {
        setOverlayHidden(false);
        try {
          await analyzeBom();
        } finally {
          setOverlayHidden(true);
        }
      });
    }

    if (demoBtn) {
      const demoTriggersAnalysis = typeof loadDemoBom === "function" && /analyzeBom\s*\(/.test(String(loadDemoBom));
      demoBtn.addEventListener("click", async () => {
        if (!demoTriggersAnalysis) {
          loadDemoBom();
          return;
        }
        setOverlayHidden(false);
        try {
          await loadDemoBom();
        } finally {
          setOverlayHidden(true);
        }
      });
    }
  }

  renderApiKeyBanner();
  wireButtons();
})();
