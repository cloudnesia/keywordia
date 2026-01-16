<script>
  import {
    theme,
    isReadOnly,
    mindMap,
    layout,
    isPresentationMode,
    presentationSignal,
  } from "./store";
  import { toasts } from "./stores/toast";
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { PUBLIC_GOOGLE_CLIENT_ID } from "$env/static/public";
  import ShareModal from "./ShareModal.svelte";

  export let user = null;
  export let mapId = null;
  export let canEdit = false;
  export let isEditable = false;
  export let isOwner = false;

  let showShareModal = false;
  let saveStatus = "Saved";
  let hasUnsavedChanges = false;
  let isInitialLoad = true;
  let saveTimeout;
  const DEBOUNCE_DELAY = 1000;

  // React to store changes to auto-save with debounce
  $: {
    $mindMap;
    if (isInitialLoad) {
      isInitialLoad = false;
    } else {
      if (!$isReadOnly) {
        hasUnsavedChanges = true;
        saveStatus = "Unsaved changes...";

        if (saveTimeout) clearTimeout(saveTimeout);

        if (mapId) {
          saveTimeout = setTimeout(() => {
            handleSave();
          }, DEBOUNCE_DELAY);
        }
      }
    }
  }

  async function handleSave() {
    if (!mapId) return;
    saveStatus = "Saving...";
    try {
      const res = await fetch(`/api/map/${mapId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: $mindMap }),
      });
      if (res.ok) {
        hasUnsavedChanges = false;
        saveStatus = "Saved";
        toasts.add("Map saved successfully", "success");
      } else {
        saveStatus = "Not saved (Server Error)";
        toasts.add("Failed to save map", "error");
      }
    } catch (e) {
      console.error(e);
      saveStatus = "Not saved (Network Error)";
      toasts.add("Network error: Failed to save map", "error");
    }
  }

  function handleLogin(response) {
    fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ token: response.credential }),
      headers: { "Content-Type": "application/json" },
    })
      .then(async (res) => {
        if (res.ok) {
          toasts.add("Logged in successfully", "success");
          setTimeout(() => location.reload(), 500);
        } else {
          toasts.add("Login failed", "error");
        }
      })
      .catch((e) => {
        toasts.add("Login error: " + e.message, "error");
      });
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toasts.add("Logged out successfully", "success");
      setTimeout(() => (location.href = "/"), 500);
    } catch (e) {
      toasts.add("Logout failed", "error");
    }
  }

  onMount(() => {
    // Google Login Init
    if (!user && window.google) {
      window.google.accounts.id.initialize({
        client_id: PUBLIC_GOOGLE_CLIENT_ID,
        callback: handleLogin,
      });
      window.google.accounts.id.renderButton(
        document.getElementById("google-btn"),
        { theme: "outline", size: "large" },
      );
    }
  });

  onDestroy(() => {
    if (saveTimeout) clearTimeout(saveTimeout);
  });

  function toggleTheme() {
    theme.update((t) => {
      const newTheme = t === "dark" ? "light" : "dark";
      if (newTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return newTheme;
    });
  }

  function toggleLayout() {
    layout.update((l) => (l === "top-down" ? "left-to-right" : "top-down"));
  }

  function togglePresentation() {
    isPresentationMode.update((v) => {
      const newValue = !v;
      // Trigger collapse/expand reset on both enter and exit
      presentationSignal.update((n) => n + 1);
      return newValue;
    });
  }

  async function downloadJSON() {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify($mindMap));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "mindmap.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }

  function openShare() {
    showShareModal = true;
  }

  import { page } from "$app/stores";
  import Logo from "./Logo.svelte";
  import { exportToMarkdown, exportToImage, exportToPDF } from "./exportUtils";
  import LoadingModal from "./components/LoadingModal.svelte";
  import { undo, redo, history } from "./store";

  let isExporting = false;
  let exportMessage = "Exporting...";

  // Keyboard Shortcuts
  function handleKeydown(e) {
    if (!isOwner) return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === "z") {
        e.preventDefault();
        undo();
      } else if (e.key === "y") {
        e.preventDefault();
        redo();
      }
    }
  }

  async function handleExport(type) {
    isExporting = true;
    exportMessage = `Generating ${type}...`;

    const isDark = $theme === "dark";
    const backgroundColor = isDark ? "#111827" : "#f9fafb";

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (type === "Markdown") {
        exportToMarkdown();
      } else if (type === "PNG") {
        await exportToImage("map-container", { backgroundColor });
      } else if (type === "PDF") {
        await exportToPDF("map-container", { backgroundColor });
      }
    } catch (e) {
      console.error("Export failed", e);
      toasts.add(`Failed to export ${type}`, "error");
    } finally {
      isExporting = false;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />
<LoadingModal isOpen={isExporting} message={exportMessage} />

<ShareModal
  isOpen={showShareModal}
  url={$page.url.href}
  {mapId}
  {isEditable}
  {user}
  on:close={() => (showShareModal = false)}
/>

<div
  class="fixed top-4 left-4 right-4 flex justify-between items-center bg-white/10 backdrop-blur-md p-2 rounded-xl shadow-lg z-50 border border-white/20"
>
  <div class="flex items-center gap-2">
    <Logo size={8} />
    <h1
      class="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent hidden sm:block"
    >
      <a href="/"> Keywordia </a>
    </h1>
    {#if user}
      <span class="text-sm font-medium">Hello, {user.name}</span>
    {/if}
  </div>

  <div class="flex gap-2 items-center">
    {#if mapId}
      <!-- Status Indicator -->
      {#if canEdit}
        <span
          class="text-xs font-mono px-2 min-w-[80px] text-right {saveStatus.includes(
            'not saved',
          )
            ? 'text-red-500 font-bold'
            : 'text-gray-500 dark:text-gray-400'}"
        >
          {saveStatus}
        </span>
      {/if}

      <button
        on:click={toggleLayout}
        class="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:opacity-80 transition-all font-medium text-sm cursor-pointer"
        title="Toggle Layout"
      >
        {$layout === "top-down" ? "⬇️ Tree" : "➡️ Linear"}
      </button>

      {#if isOwner}
        <button
          on:click={undo}
          disabled={$history.past.length === 0}
          class="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:opacity-80 transition-all font-medium text-sm cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          ↩️
        </button>
        <button
          on:click={redo}
          disabled={$history.future.length === 0}
          class="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:opacity-80 transition-all font-medium text-sm cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Y)"
        >
          ↪️
        </button>
      {/if}

      {#if canEdit}
        <button
          on:click={togglePresentation}
          class="px-3 py-1.5 rounded-lg {$isPresentationMode
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-200 dark:bg-gray-700'} hover:opacity-80 transition-all font-medium text-sm cursor-pointer"
          title={$isPresentationMode
            ? "Exit Presentation"
            : "Start Presentation"}
        >
          {$isPresentationMode ? "Make changes data" : "Start Presentation"}
        </button>
      {/if}

      <!-- Manual Save Button REMOVED -->

      {#if isOwner}
        <button
          on:click={openShare}
          class="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:opacity-80 transition-all font-medium text-sm cursor-pointer"
          >Share</button
        >
      {/if}

      <!-- Export Dropdown -->
      <div class="relative group">
        <button
          class="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:opacity-80 transition-all font-medium text-sm cursor-pointer flex items-center gap-1"
        >
          📤 Export
        </button>
        <!-- Dropdown wrapper with top padding to bridge the gap -->
        <div
          class="absolute right-0 top-full w-48 hidden group-hover:block z-50 pt-2"
        >
          <div
            class="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <button
              on:click={downloadJSON}
              class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 cursor-pointer"
            >
              📄 JSON (Backup)
            </button>
            <button
              on:click={() => handleExport("Markdown")}
              class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 cursor-pointer"
            >
              📝 Markdown
            </button>
            <button
              on:click={() => handleExport("PNG")}
              class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 cursor-pointer"
            >
              🖼️ Image (PNG)
            </button>
            <button
              on:click={() => handleExport("PDF")}
              class="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2 cursor-pointer"
            >
              📑 PDF
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if !user}
      <div id="google-btn"></div>
    {:else}
      <button
        on:click={handleLogout}
        class="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-all font-medium text-sm cursor-pointer"
        >Logout</button
      >
    {/if}
  </div>
</div>
