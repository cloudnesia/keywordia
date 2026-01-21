<script>
  import CommentBox from "./components/CommentBox.svelte";
  import {
    addChild,
    updateNodeText,
    isReadOnly,
    layout,
    focusedNodeId,
    deleteNode,
    addSibling,
    mapOwnerId,
    startTransaction,
    commitTransaction,
    discardTransaction,
    isPresentationMode,
    presentationSignal,
    comments,
    activeCommentNodeId,
    currentUser,
    activeDocNodeId,
  } from "./store";
  import { onMount, createEventDispatcher } from "svelte";

  export let node;
  export let isRoot = false;
  // We need mindMapId to pass to CommentBox.
  // Since MindMapNode is recursive, we might need to pass it down or get it from store (which we need to add if not exists, but we can verify param).
  // Actually, we can get it from page params if we were in a page, but here we are in a component.
  // Ideally, `mindMap` store should have the ID? `mindMap` store structure is just the tree content according to store.js: { id: 'root', text... }
  // We need the ACTUAL map ID for the DB.
  // Let's check `src/routes/[id]/+page.svelte` or similar to see how map ID is handled.
  // For now I'll add a prop `mindMapId` to MindMapNode and cascade it.
  export let mindMapId;

  let expanded = true;
  let element; // Reference to the contenteditable div
  let initialText = "";
  const DEFAULT_TEXT = "New Node";

  // Reactive comments for this node
  $: nodeComments = $comments[node.id] || [];
  $: commentCount = nodeComments.length;
  $: showCommentBox = $activeCommentNodeId === node.id;

  function toggleCommentBox() {
    if ($activeCommentNodeId === node.id) {
      activeCommentNodeId.set(null);
    } else {
      activeCommentNodeId.set(node.id);
    }
  }

  function openDocEditor() {
    activeDocNodeId.set(node.id);
  }

  // Presentation Mode: Handle enter (collapse) and exit (expand)
  $: if ($presentationSignal) {
    if ($isPresentationMode) {
      // Enter: Collapse all except root
      if (!isRoot) {
        expanded = false;
      } else {
        expanded = true;
      }
      activeCommentNodeId.set(null); // Close comments in presentation mode
    } else {
      // Exit: Expand all (recursive because every component instance reacts)
      expanded = true;
    }
  }

  // Click handler for presentation mode to toggle children
  function handleNodeClick() {
    if ($isPresentationMode && node.children.length > 0) {
      toggleExpand();
    }
  }

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

  function finalizeText() {
    if (!element) return;

    const text = element.textContent.trim();
    let finalVal = text;

    // Restore default text if empty
    if (text === "") {
      finalVal = isRoot ? "Central Topic" : "New Node";
      if (finalVal !== node.text) {
        updateNodeText(node.id, finalVal);
      }
      element.textContent = finalVal;
    } else {
      // Only update if text has changed to prevent unnecessary triggers
      if (finalVal !== node.text) {
        updateNodeText(node.id, finalVal);
      }
    }

    // Commit if changed effective text, else discard
    // We compare finalVal with initialText to see if the SESSION resulted in a change
    if (finalVal !== initialText) {
      commitTransaction();
    } else {
      discardTransaction();
    }
    initialText = ""; // Reset to prevent double handling
  }

  function handleInput(e) {
    updateNodeText(node.id, e.target.textContent);
  }

  function handleFocus(e) {
    startTransaction();
    initialText = node.text; // Always capture the starting text

    const text = e.target.textContent.trim();
    if (text === "New Node" || (isRoot && text === "Central Topic")) {
      e.target.textContent = "";
      // Removed updateNodeText to prevent auto-save on focus
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
      finalizeText();

      if (isRoot) {
        handleAdd();
      } else {
        addSibling(node.id);
      }
    }

    // Tab: Add Child
    if (e.key === "Tab") {
      e.preventDefault();
      finalizeText();

      handleAdd();
    }

    // Delete/Backspace: Delete Node
    if (
      e.key === "Delete" ||
      (e.key === "Backspace" && e.target.textContent.trim() === "")
    ) {
      if (!isRoot) {
        if (
          node.text === "" ||
          node.text === "New Node" ||
          e.target.textContent.trim() === ""
        ) {
          e.preventDefault();

          // For delete, we just want to discard any pending text transaction
          // because the node is going away. We don't need to save the text state.
          discardTransaction();
          deleteNode(node.id);
        }
      }
    }

    // Explicit Delete command (Shift+Delete)
    if (e.key === "Delete" && e.shiftKey && !isRoot) {
      e.preventDefault();
      discardTransaction();
      deleteNode(node.id);
    }
  }

  function handleBlur(e) {
    finalizeText();
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
    on:click|stopPropagation={handleNodeClick}
    role="button"
    tabindex="0"
    on:keypress={(e) => {
      if (e.key === "Enter") handleNodeClick();
    }}
    class="flex items-center gap-2 p-2 rounded-lg transition-all duration-300 relative group
    {showCommentBox ? 'z-[100]' : 'z-10'}
    {$isReadOnly || $isPresentationMode ? '' : 'hover:scale-105'}
    {$isPresentationMode && node.children.length > 0
      ? 'cursor-pointer hover:ring-2 hover:ring-indigo-400'
      : ''}
    {!expanded &&
    node.children &&
    node.children.length > 0 &&
    $isPresentationMode
      ? 'shadow-[4px_4px_0_0_rgba(156,163,175,0.3),8px_8px_0_0_rgba(156,163,175,0.15)] dark:shadow-[4px_4px_0_0_rgba(75,85,99,0.5),8px_8px_0_0_rgba(75,85,99,0.3)]'
      : ''}
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
    <!-- Expand/Collapse for parents (Hidden in Presentation Mode) -->
    {#if node.children && node.children.length > 0 && !$isPresentationMode}
      <button
        on:click|stopPropagation={toggleExpand}
        class="text-xs mr-1 opacity-50 hover:opacity-100 cursor-pointer"
      >
        {expanded ? "−" : "+"}
      </button>
    {/if}

    <div
      contenteditable={!$isReadOnly && !$isPresentationMode}
      bind:this={element}
      on:input={handleInput}
      on:keydown={handleKeydown}
      on:focus={handleFocus}
      on:blur={handleBlur}
      class="outline-none min-w-[50px] {isRoot
        ? 'text-center'
        : 'text-left'} px-2 py-1 {$isReadOnly || $isPresentationMode
        ? 'cursor-default pointer-events-none'
        : 'cursor-text'} empty:before:content-[attr(placeholder)] focus:before:content-none"
      placeholder="Node"
    ></div>

    <!-- Comment Icon -->
    {#if !$isPresentationMode || commentCount > 0}
      <div
        class="absolute
        {$layout === 'top-down'
          ? '-right-0 top-1/2 translate-x-1/2 -translate-y-1/2'
          : 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2'}
        flex gap-1 items-center
      "
      >
        <!-- Doc Icon -->
        <button
          on:click|stopPropagation={openDocEditor}
          class="p-1 rounded-full bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm border border-gray-200 dark:border-gray-700
           opacity-0 group-hover:opacity-100 {node.docContent
            ? 'opacity-100 text-blue-500'
            : 'text-gray-400'}"
          title="Document"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="w-3 h-3"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
            />
          </svg>
        </button>

        <!-- Comment Button -->
        <button
          on:click|stopPropagation={toggleCommentBox}
          class="p-1 rounded-full transition-colors group/comment relative {commentCount >
          0
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100'}"
          title="Comments"
        >
          {#if commentCount > 0}
            <div
              class="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-[10px] text-white font-bold shadow-sm"
            >
              {commentCount > 9 ? "9+" : commentCount}
            </div>
          {:else}
            <!-- New 'C' Icon with Contrast -->
            <div
              class="w-5 h-5 rounded-full bg-indigo-600 border border-indigo-700 text-white flex items-center justify-center text-[10px] font-bold shadow-sm"
            >
              C
            </div>
          {/if}
        </button>
      </div>
    {/if}

    <!-- Comment Box (Floating) -->
    {#if showCommentBox}
      <CommentBox
        nodeId={node.id}
        {mindMapId}
        {nodeComments}
        isReadOnly={$isReadOnly || $isPresentationMode}
        on:close={() => activeCommentNodeId.set(null)}
      />
    {/if}

    <!-- Add Child Button -->
    {#if !$isReadOnly && !$isPresentationMode}
      <button
        on:click|stopPropagation={handleAdd}
        class="absolute w-6 h-6 flex items-center justify-center rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors shadow-sm text-sm cursor-pointer z-50 opacity-0 group-hover:opacity-100
        {$layout === 'top-down'
          ? '-bottom-3 left-1/2 -translate-x-1/2'
          : '-right-3 top-1/2 -translate-y-1/2'}"
        title="Add Child"
      >
        +
      </button>
    {/if}
  </div>

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
            <svelte:self node={child} {mindMapId} />
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
