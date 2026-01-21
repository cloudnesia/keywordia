<script>
    import { onMount, onDestroy } from "svelte";
    import { Editor } from "@tiptap/core";
    import StarterKit from "@tiptap/starter-kit";
    import { Image } from "@tiptap/extension-image";
    import { Youtube } from "@tiptap/extension-youtube";
    import { Placeholder } from "@tiptap/extension-placeholder";
    import { TaskList } from "@tiptap/extension-task-list";
    import { TaskItem } from "@tiptap/extension-task-item";
    import { Table } from "@tiptap/extension-table";
    import { TableRow } from "@tiptap/extension-table-row";
    import { TableCell } from "@tiptap/extension-table-cell";
    import { TableHeader } from "@tiptap/extension-table-header";
    import { Link } from "@tiptap/extension-link";
    import {
        activeDocNodeId,
        updateNodeContent,
        mindMap,
        recordHistory,
        startTransaction,
        commitTransaction,
        discardTransaction,
    } from "../store.js";

    export let nodeId;
    export let initialContent = "";

    let element;
    let editor;

    // Helper to find node content directly from store
    const findNode = (nodes, id) => {
        if (nodes.id === id) return nodes;
        if (nodes.children) {
            for (const child of nodes.children) {
                const found = findNode(child, id);
                if (found) return found;
            }
        }
        return null;
    };

    onMount(() => {
        // Get fresh content from store just in case
        const currentMap = $mindMap;
        const node = findNode(currentMap, nodeId);
        const content = node?.docContent || initialContent || "";

        editor = new Editor({
            element: element,
            extensions: [
                StarterKit,
                Placeholder.configure({
                    placeholder:
                        "Write something amazing... (# H1, - List, [ ] Task)",
                }),
                Image,
                Youtube.configure({
                    controls: false,
                }),
                TaskList,
                TaskItem.configure({
                    nested: true,
                }),
                Table.configure({
                    resizable: true,
                }),
                TableRow,
                TableHeader,
                TableCell,
                Link.configure({
                    openOnClick: false,
                }),
            ],
            content: content,
            editorProps: {
                attributes: {
                    class: "prose prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto focus:outline-none h-full p-4 overflow-y-auto max-w-none dark:prose-invert prose-img:rounded-md prose-img:shadow-md",
                },
            },
            onTransaction: () => {
                // force re-render?
                editor = editor;
            },
            onUpdate: ({ editor }) => {
                const html = editor.getHTML();
                // Debounce or save logic? For now, let's update store on every change (or use a debouncer for performance)
                // Using a simple transaction logic might be heavy if done on every keypress.
                // Let's just update the store directly and use a "Save" button or auto-save on close for history recording.
                // But user asked for "live preview", so we keep it synced.
                updateNodeContent(nodeId, html);
            },
        });
    });

    onDestroy(() => {
        if (editor) {
            editor.destroy();
        }
    });

    const addImage = () => {
        const url = window.prompt("URL");
        if (url) {
            editor.chain().focus().setImage({ src: url }).run();
        }
    };

    const uploadImage = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();
            if (data.url) {
                editor.chain().focus().setImage({ src: data.url }).run();
            } else {
                alert("Upload failed");
            }
        } catch (e) {
            console.error(e);
            alert("Error uploading image");
        }
    };

    const addYoutube = () => {
        const url = window.prompt("Enter YouTube URL");

        if (url) {
            editor.commands.setYoutubeVideo({
                src: url,
                width: 640,
                height: 480,
            });
        }
    };

    function closeEditor() {
        // Commit any transaction if we started one
        activeDocNodeId.set(null);
    }
</script>

<div
    class="fixed inset-0 z-[100] flex justify-end bg-black/20 backdrop-blur-[2px] p-0"
>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
        class="bg-white dark:bg-gray-800 w-full max-w-[600px] h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300 border-l border-gray-200 dark:border-gray-700"
    >
        <!-- Toolbar -->
        <div
            class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
        >
            <div class="flex items-center gap-2 overflow-x-auto">
                <button
                    on:click={() => editor.chain().focus().toggleBold().run()}
                    class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 {editor?.isActive(
                        'bold',
                    )
                        ? 'bg-gray-200 dark:bg-gray-700 text-blue-600'
                        : ''}"
                    title="Bold"
                >
                    <b>B</b>
                </button>
                <button
                    on:click={() => editor.chain().focus().toggleItalic().run()}
                    class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 {editor?.isActive(
                        'italic',
                    )
                        ? 'bg-gray-200 dark:bg-gray-700 text-blue-600'
                        : ''}"
                    title="Italic"
                >
                    <i>I</i>
                </button>
                <button
                    on:click={() => editor.chain().focus().toggleStrike().run()}
                    class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 {editor?.isActive(
                        'strike',
                    )
                        ? 'bg-gray-200 dark:bg-gray-700 text-blue-600'
                        : ''}"
                    title="Strikethrough"
                >
                    <s>S</s>
                </button>
                <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                <button
                    on:click={() =>
                        editor
                            .chain()
                            .focus()
                            .toggleHeading({ level: 1 })
                            .run()}
                    class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 {editor?.isActive(
                        'heading',
                        { level: 1 },
                    )
                        ? 'bg-gray-200 dark:bg-gray-700 text-blue-600'
                        : ''}"
                >
                    H1
                </button>
                <button
                    on:click={() =>
                        editor
                            .chain()
                            .focus()
                            .toggleHeading({ level: 2 })
                            .run()}
                    class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 {editor?.isActive(
                        'heading',
                        { level: 2 },
                    )
                        ? 'bg-gray-200 dark:bg-gray-700 text-blue-600'
                        : ''}"
                >
                    H2
                </button>
                <div class="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>

                <label
                    class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer"
                    title="Upload Image"
                >
                    <input
                        type="file"
                        accept="image/*"
                        class="hidden"
                        on:change={uploadImage}
                    />
                    🖼️
                </label>

                <button
                    on:click={addYoutube}
                    class="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                    title="Add YouTube Video"
                >
                    ▶️
                </button>
            </div>

            <button
                on:click={closeEditor}
                class="p-2 rounded-full hover:bg-red-100 text-red-500 hover:text-red-700 transition"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="w-6 h-6"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M6 18 18 6M6 6l12 12"
                    />
                </svg>
            </button>
        </div>

        <!-- Editor Content -->
        <div
            class="flex-1 overflow-hidden relative bg-white dark:bg-gray-800"
            bind:this={element}
        ></div>
    </div>
</div>

<style>
    /* Add any custom Tiptap styles here if Tailwind prose isn't enough */
    :global(.ProseMirror) {
        min-height: 100%;
        outline: none;
    }
    :global(.ProseMirror p.is-editor-empty:first-child::before) {
        content: attr(data-placeholder);
        float: left;
        color: #adb5bd;
        pointer-events: none;
        height: 0;
    }

    /* Task List Support */
    :global(ul[data-type="taskList"]) {
        list-style: none;
        padding: 0;
    }
    :global(li[data-type="taskItem"]) {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    :global(li[data-type="taskItem"] input[type="checkbox"]) {
        cursor: pointer;
        margin: 0;
    }

    /* Table Support */
    :global(table) {
        border-collapse: collapse;
        table-layout: fixed;
        width: 100%;
        margin: 0;
        overflow: hidden;
    }

    :global(td),
    :global(th) {
        min-width: 1em;
        border: 2px solid #ced4da;
        padding: 3px 5px;
        vertical-align: top;
        box-sizing: border-box;
        position: relative;
    }

    :global(th) {
        font-weight: bold;
        text-align: left;
        background-color: #f1f3f5;
    }

    :global(.dark th) {
        background-color: #374151;
        border-color: #4b5563;
    }
    :global(.dark td) {
        border-color: #4b5563;
    }
</style>
