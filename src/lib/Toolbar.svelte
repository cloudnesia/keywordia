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
  import { env } from "$env/dynamic/public";
  const { PUBLIC_GOOGLE_CLIENT_ID } = env;
  import ShareModal from "./ShareModal.svelte";
  import { fly } from "svelte/transition";

  export let user = null;
  export let mapId = null;
  export let mapSlug = null;
  export let canEdit = false;
  export let isEditable = false;
  export let isOwner = false;

  // Update url to construction if mapSlug is present
  $: shareUrl = mapSlug ? `${$page.url.origin}/map/${mapSlug}` : $page.url.href;

  let showShareModal = false;
  let saveStatus = "Saved";
  let hasUnsavedChanges = false;
  let isInitialLoad = true;
  let saveTimeout;
  const DEBOUNCE_DELAY = 5000;

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

        // Update slug if changed
        try {
          const data = await res.json();
          if (data.map && data.map.slug && data.map.slug !== mapSlug) {
            mapSlug = data.map.slug;
          }
        } catch (e) {
          /* ignore json parse error */
        }

        // toasts.add("Map saved successfully", "success");
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

  function handleLogin(accessToken) {
    fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ token: accessToken }),
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
    if (!user) {
      const initGoogle = () => {
        if (window.google) {
          /* global google */
          const client = google.accounts.oauth2.initTokenClient({
            client_id: PUBLIC_GOOGLE_CLIENT_ID,
            scope: "openid profile email",
            callback: (tokenResponse) => {
              if (tokenResponse && tokenResponse.access_token) {
                handleLogin(tokenResponse.access_token);
              }
            },
          });

          window.googleLogin = () => {
            client.requestAccessToken();
          };
          return true;
        }
        return false;
      };

      if (!initGoogle()) {
        const interval = setInterval(() => {
          if (initGoogle()) {
            clearInterval(interval);
          }
        }, 100);

        // Clear interval after 10 seconds to avoid infinite polling
        setTimeout(() => clearInterval(interval), 10000);
      }
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

  let showExportMenu = false;
  let exportBtn;
  let menuPos = { top: 0, right: 0 };

  function toggleExportMenu() {
    if (!showExportMenu && exportBtn) {
      const rect = exportBtn.getBoundingClientRect();
      menuPos = {
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      };
    }
    showExportMenu = !showExportMenu;
  }

  function handleWindowClick(e) {
    if (
      showExportMenu &&
      !e.target.closest(".export-menu") &&
      exportBtn &&
      !exportBtn.contains(e.target)
    ) {
      showExportMenu = false;
    }
  }

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

<svelte:window on:keydown={handleKeydown} on:click={handleWindowClick} />
<LoadingModal isOpen={isExporting} message={exportMessage} />

<ShareModal
  isOpen={showShareModal}
  url={shareUrl}
  {mapId}
  {isEditable}
  {user}
  on:close={() => (showShareModal = false)}
/>

<div
  class="fixed top-4 left-4 right-4 flex justify-between items-center bg-white/10 backdrop-blur-md p-2 rounded-xl shadow-lg z-50 border border-white/20 overflow-x-auto max-w-[calc(100vw-2rem)] no-scrollbar"
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

  <div class="flex gap-2 items-center flex-nowrap">
    {#if mapId}
      <!-- Status Indicator -->
      {#if canEdit}
        <span
          class="text-xs font-mono px-2 min-w-[80px] text-right hidden sm:block {saveStatus.includes(
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
        class="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:opacity-80 transition-all font-medium text-sm cursor-pointer whitespace-nowrap"
        title="Toggle Layout"
      >
        <span>{$layout === "top-down" ? "⬇️" : "➡️"}</span>
        <span class="hidden sm:inline ml-1"
          >{$layout === "top-down" ? "Tree" : "Linear"}</span
        >
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
            : 'bg-gray-200 dark:bg-gray-700'} hover:opacity-80 transition-all font-medium text-sm cursor-pointer whitespace-nowrap"
          title={$isPresentationMode
            ? "Exit Presentation"
            : "Start Presentation"}
        >
          <span class="mr-1">{$isPresentationMode ? "❌" : "📺"}</span>
          <span class="hidden sm:inline"
            >{$isPresentationMode ? "Exit" : "Present"}</span
          >
        </button>
      {/if}

      <!-- Manual Save Button REMOVED -->

      {#if isOwner}
        <button
          on:click={openShare}
          class="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:opacity-80 transition-all font-medium text-sm cursor-pointer whitespace-nowrap"
          >Share</button
        >
      {/if}

      <!-- Export Button -->
      <button
        bind:this={exportBtn}
        on:click|stopPropagation={toggleExportMenu}
        class="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 hover:opacity-80 transition-all font-medium text-sm cursor-pointer flex items-center gap-1 whitespace-nowrap {showExportMenu
          ? 'ring-2 ring-blue-400'
          : ''}"
      >
        <span>📤</span>
        <span class="hidden sm:inline">Export</span>
      </button>
    {/if}

    {#if !user}
      <button
        on:click={() => window.googleLogin && window.googleLogin()}
        class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all font-medium text-sm cursor-pointer flex items-center gap-2"
      >
        <svg class="w-4 h-4 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.24.81-.6z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Sign in
      </button>
    {:else}
      <button
        on:click={handleLogout}
        class="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-all font-medium text-sm cursor-pointer whitespace-nowrap"
        >Logout</button
      >
    {/if}
  </div>
</div>

{#if showExportMenu}
  <div
    class="export-menu fixed z-[60] w-48 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
    style="top: {menuPos.top}px; right: {menuPos.right}px;"
    transition:fly={{ y: -10, duration: 200 }}
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
{/if}
