(function () {
    "use strict";

    const MAX_FILES = 5;
    const MAX_FILE_BYTES = 25 * 1024 * 1024;
    const ALLOWED_EXTENSIONS = new Set([
        ".pdf", ".mp3", ".mp4", ".wav", ".m4a", ".aac", ".avi",
        ".mov", ".mkv", ".flac", ".ogg"
    ]);
    const apiUrlInput = document.getElementById("apiUrl");
    const authHeaderInput = document.getElementById("authHeader");
    const authTokenInput = document.getElementById("authToken");
    const promptInput = document.getElementById("prompt");
    const filesInput = document.getElementById("files");
    const fileSummary = document.getElementById("fileSummary");
    const form = document.getElementById("agentForm");
    const submitButton = document.getElementById("submitButton");
    const healthStatus = document.getElementById("healthStatus");
    const message = document.getElementById("message");
    const downloadLink = document.getElementById("downloadLink");

    function getBaseUrl() {
        return (apiUrlInput.value.trim() || "http://localhost:8000").replace(/\/+$/, "");
    }

    function getRequestHeaders() {
        const header = authHeaderInput.value.trim();
        let token = authTokenInput.value.trim();
        if (header.toLowerCase() === "authorization" && token && !/^Bearer\s/i.test(token)) {
            token = "Bearer " + token;
        }
        return header && token ? { [header]: token } : {};
    }

    function setMessage(text, isError) {
        message.textContent = text;
        message.className = isError ? "message error" : "message";
    }

    function setHealth(online) {
        healthStatus.textContent = online ? "Backend online" : "Backend offline";
        healthStatus.className = online ? "status status-online" : "status status-offline";
    }

    function validateFiles(files) {
        if (files.length > MAX_FILES) return "Select no more than 5 files.";
        for (const file of files) {
            const dot = file.name.lastIndexOf(".");
            const extension = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
            if (!ALLOWED_EXTENSIONS.has(extension)) return "Unsupported file type: " + file.name;
            if (file.size > MAX_FILE_BYTES) return file.name + " is larger than 25 MB.";
        }
        return "";
    }

    function updateFileSummary() {
        const files = Array.from(filesInput.files);
        const error = validateFiles(files);
        fileSummary.textContent = error || (files.length ? files.length + " file(s) ready." : "No files selected.");
        fileSummary.className = error ? "hint error" : "hint";
    }

    async function checkHealth() {
        try {
            const response = await fetch(getBaseUrl() + "/health", { headers: getRequestHeaders(), signal: AbortSignal.timeout(5000) });
            setHealth(response.ok);
        } catch (_) {
            setHealth(false);
        }
    }

    const configured = window.AWSENGERS_AGENT_CONFIG || {};
    apiUrlInput.value = localStorage.getItem("awsengersAgentApiUrl") || configured.apiUrl || "http://localhost:8000";
    authHeaderInput.value = localStorage.getItem("awsengersAgentAuthHeader") || configured.authHeader || "";
    authTokenInput.value = localStorage.getItem("awsengersAgentAuthToken") || configured.authToken || "";
    [apiUrlInput, authHeaderInput, authTokenInput].forEach(function (input) {
        input.addEventListener("change", function () {
            localStorage.setItem("awsengersAgentApiUrl", getBaseUrl());
            localStorage.setItem("awsengersAgentAuthHeader", authHeaderInput.value.trim());
            localStorage.setItem("awsengersAgentAuthToken", authTokenInput.value.trim());
            checkHealth();
        });
    });
    filesInput.addEventListener("change", updateFileSummary);
    checkHealth();

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        const files = Array.from(filesInput.files);
        const validationError = validateFiles(files);
        if (validationError) return setMessage(validationError, true);
        if (!promptInput.value.trim()) return setMessage("Enter an instruction first.", true);

        const body = new FormData();
        body.append("prompt", promptInput.value.trim());
        files.forEach(function (file) { body.append("files", file, file.name); });
        submitButton.disabled = true;
        downloadLink.hidden = true;
        setMessage("Processing…", false);

        try {
            const response = await fetch(getBaseUrl() + "/process", { method: "POST", headers: getRequestHeaders(), body: body });
            const data = await response.json().catch(function () { return {}; });
            if (!response.ok) throw new Error(data.detail || ("Request failed (" + response.status + ")"));
            setHealth(true);
            setMessage(data.response || "The agent completed without a text response.", false);
            if (data.download_url) {
                downloadLink.href = new URL(data.download_url, getBaseUrl()).href;
                downloadLink.textContent = "Download generated file";
                downloadLink.hidden = false;
            }
        } catch (error) {
            setHealth(false);
            setMessage("Agent unavailable: " + (error.message || "network error") + " Check the API URL and backend status.", true);
        } finally {
            submitButton.disabled = false;
        }
    });
}());
