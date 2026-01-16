<script>
  import {
    addChild,
    updateNodeText,
    isReadOnly,
    layout,
    focusedNodeId,
    deleteNode,
    addSibling,
    mapOwnerId,
  } from "./store";
  import { onMount } from "svelte";

  export let node;
  export let isRoot = false;

  let expanded = true;
  let element; // Reference to the contenteditable div
  const DEFAULT_TEXT = "New Node";

  // Auto-focus logic
  $: if ($focusedNodeId === node.id && element) {
    if (node.text === "New Node" || (isRoot && node.text === "Central Topic")) {
      updateNodeText(node.id, "");
    }
    element.focus();
  }

  // Manual text sync to prevent cursor jumping during edits
  $: if (element && node.text !== element.textContent) {
    element.textContent = node.text;
  }

  function handleInput(e) {
    updateNodeText(node.id, e.target.textContent);
  }

  function handleFocus(e) {
    const text = e.target.textContent.trim();
    if (text === "New Node" || (isRoot && text === "Central Topic")) {
      e.target.textContent = "";
      updateNodeText(node.id, ""); // Sync store to prevent reactive revert
    }
    if ($focusedNodeId === node.id) {
      focusedNodeId.set(null);
    }
  }

  function handleKeydown(e) {
    if ($isReadOnly) return;

    // Enter: Add Sibling
    if (e.key === "Enter") {
      e.preventDefault();
      if (isRoot) {
        handleAdd();
      } else {
        addSibling(node.id);
      }
    }

    // Tab: Add Child
    if (e.key === "Tab") {
      e.preventDefault();
      handleAdd();
    }

    // Delete/Backspace: Delete Node
    if (
      e.key === "Delete" ||
      (e.key === "Backspace" && e.target.textContent === "")
    ) {
      if (!isRoot) {
        if (node.text === "" || node.text === "New Node") {
          e.preventDefault();
          deleteNode(node.id);
        }
      }
    }

    // Explicit Delete command (Shift+Delete)
    if (e.key === "Delete" && e.shiftKey && !isRoot) {
      e.preventDefault();
      deleteNode(node.id);
    }
  }

  function handleBlur(e) {
    const text = e.target.textContent.trim();
    if (text === "") {
      e.target.textContent = isRoot ? "Central Topic" : "New Node";
      updateNodeText(node.id, e.target.textContent);
    } else {
      updateNodeText(node.id, text);
    }
  }

  function handleAdd() {
    addChild(node.id);
    expanded = true;
  }

  function toggleExpand() {
    expanded = !expanded;
  }

  import { getColor } from "./utils";

  $: collabColor =
    node.createdBy && node.createdBy.id !== $mapOwnerId
      ? getColor(node.createdBy.id)
      : null;
</script>

<div
  class="flex {$layout === 'top-down' ? 'flex-col' : 'flex-row'} items-center"
>
  <div
    class="flex items-center gap-2 p-2 rounded-lg transition-all duration-300 z-10 relative
    {$isReadOnly ? '' : 'hover:scale-105'}
    {isRoot
      ? 'bg-blue-600 text-white text-xl font-bold shadow-lg'
      : collabColor
        ? 'text-gray-900 border border-gray-300 shadow'
        : 'bg-white dark:bg-gray-800 dark:text-gray-200 shadow border border-gray-200 dark:border-gray-700'}
  "
    style={collabColor ? `background-color: ${collabColor};` : ""}
    title={node.createdBy && node.createdBy.id !== $mapOwnerId
      ? `Created by ${node.createdBy.name}`
      : ""}
  >
    <!-- Expand/Collapse for parents -->
    {#if node.children && node.children.length > 0}
      <button
        on:click={toggleExpand}
        class="text-xs mr-1 opacity-50 hover:opacity-100 cursor-pointer"
      >
        {expanded ? "−" : "+"}
      </button>
    {/if}

    <div
      contenteditable={!$isReadOnly}
      bind:this={element}
      on:input={handleInput}
      on:keydown={handleKeydown}
      on:focus={handleFocus}
      on:blur={handleBlur}
      class="outline-none min-w-[50px] {isRoot
        ? 'text-center'
        : 'text-left'} px-2 py-1 cursor-text empty:before:content-[attr(placeholder)] focus:before:content-none"
      placeholder="Node"
    ></div>

    <!-- Add Child Button -->
    {#if !$isReadOnly}
      <button
        on:click={handleAdd}
        class="ml-2 w-6 h-6 flex items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors shadow-sm text-sm cursor-pointer"
        title="Add Child"
      >
        +
      </button>
    {/if}
  </div>

  <!-- Children Container -->
  <!-- Children Container -->
  {#if expanded && node.children && node.children.length > 0}
    <div
      class="flex {$layout === 'top-down'
        ? 'flex-row pt-4'
        : 'flex-col pl-8'} items-start relative select-none"
    >
      <!-- Parent to Branch Line -->
      {#if $layout === "top-down"}
        <div
          class="absolute top-0 left-1/2 -translate-x-1/2 w-px h-4 bg-gray-300 dark:bg-gray-600"
        ></div>
      {:else}
        <div
          class="absolute top-1/2 left-0 -translate-y-1/2 h-px w-8 bg-gray-300 dark:bg-gray-600"
        ></div>
      {/if}

      {#each node.children as child, i (child.id)}
        <div
          class="relative flex flex-col items-center
             {$layout === 'top-down' ? 'px-2' : 'py-2'}
        "
        >
          <!-- Horizontal/Vertical Branch Bar -->
          {#if node.children.length > 1}
            {#if $layout === "top-down"}
              <!-- Horizontal bar logic -->
              <div
                class="absolute top-0 h-px bg-gray-300 dark:bg-gray-600"
                style="
                         left: {i === 0 ? '50%' : '0'};
                         right: {i === node.children.length - 1 ? '50%' : '0'};
                       "
              ></div>
            {:else}
              <!-- Vertical bar logic -->
              <div
                class="absolute left-0 w-px bg-gray-300 dark:bg-gray-600"
                style="
                         top: {i === 0 ? '50%' : '0'};
                         bottom: {i === node.children.length - 1 ? '50%' : '0'};
                       "
              ></div>
            {/if}
          {/if}

          <!-- Branch to Child Line (Revised) -->
          {#if $layout === "top-down"}
            <!-- Vertical line from Bar down to Node -->
            <div
              class="absolute top-0 left-1/2 -translate-x-1/2 w-px h-4 bg-gray-300 dark:bg-gray-600"
            ></div>
          {:else}
            <!-- Horizontal line from Bar right to Node -->
            <div
              class="absolute left-0 top-1/2 -translate-y-1/2 h-px w-4 bg-gray-300 dark:bg-gray-600"
            ></div>
          {/if}

          <!-- Padding for the line -->
          <div class={$layout === "top-down" ? "pt-4" : "pl-4"}>
            <svelte:self node={child} />
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
