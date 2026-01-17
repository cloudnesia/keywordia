<script>
    import { createEventDispatcher } from "svelte";
    import { fade, slide } from "svelte/transition";
    import { currentUser, mapOwnerId, comments } from "../store";

    export let nodeId;
    export let nodeComments = [];
    export let mindMapId;
    export let isReadOnly = false;

    const dispatch = createEventDispatcher();
    let newComment = "";
    let isSubmitting = false;

    $: sortedComments = [...nodeComments].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );

    $: isOwner = $currentUser?.id === $mapOwnerId;
    // Guest can read only, but if public collab toggle is on, they might be able to comment?
    // Request says: "if public colab toggle on, users can leVE COMMENT ... for guest can red only comment"
    // Assuming "guest" means unauthenticated or just non-collaborator if specific definition exists.
    // For now, if no user, strict read-only.
    $: canComment = !!$currentUser;

    async function handleSubmit() {
        if (!newComment.trim() || isSubmitting) return;

        isSubmitting = true;
        try {
            const res = await fetch("/api/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    text: newComment,
                    nodeId,
                    mindMapId,
                    userId: $currentUser.id,
                }),
            });

            if (res.ok) {
                newComment = "";
                // Optimistic update could happen here, but we rely on socket/store update
            }
        } catch (e) {
            console.error("Failed to post comment", e);
        } finally {
            isSubmitting = false;
        }
    }

    async function handleDelete(id) {
        if (!confirm("Are you sure you want to delete this comment?")) return;

        try {
            await fetch("/api/comments", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, userId: $currentUser.id }),
            });
        } catch (e) {
            console.error("Failed to delete comment", e);
        }
    }

    function formatTime(dateStr) {
        return new Date(dateStr).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
        });
    }
</script>

<div
    class="absolute top-0 left-full ml-4 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 flex flex-col overflow-hidden text-sm"
    transition:fade={{ duration: 150 }}
    on:click|stopPropagation
>
    <!-- Header -->
    <div
        class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700"
    >
        <h3 class="font-semibold text-gray-700 dark:text-gray-300">Comments</h3>
        <button
            on:click={() => dispatch("close")}
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
            ✕
        </button>
    </div>

    <!-- List -->
    <div class="flex-1 overflow-y-auto max-h-64 p-3 space-y-3">
        {#if sortedComments.length === 0}
            <p class="text-center text-gray-400 italic py-4">No comments yet</p>
        {:else}
            {#each sortedComments as comment (comment.id)}
                <div
                    class="flex gap-2 items-start group"
                    transition:slide|local
                >
                    {#if comment.user.image}
                        <img
                            src={comment.user.image}
                            alt={comment.user.name}
                            class="w-6 h-6 rounded-full mt-1"
                        />
                    {:else}
                        <div
                            class="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-xs font-bold text-indigo-700 dark:text-indigo-300 mt-1"
                        >
                            {comment.user.name
                                ? comment.user.name[0].toUpperCase()
                                : "?"}
                        </div>
                    {/if}
                    <div class="flex-1 min-w-0">
                        <div class="flex items-baseline justify-between">
                            <span
                                class="font-medium text-gray-900 dark:text-gray-100 truncate"
                                >{comment.user.name}</span
                            >
                            <span class="text-xs text-gray-400 shrink-0 ml-2"
                                >{formatTime(comment.createdAt)}</span
                            >
                        </div>
                        <p
                            class="text-gray-600 dark:text-gray-300 break-words mt-0.5"
                        >
                            {comment.text}
                        </p>
                    </div>
                    {#if !isReadOnly && (isOwner || ($currentUser && comment.userId === $currentUser.id))}
                        <button
                            on:click={() => handleDelete(comment.id)}
                            class="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                            title="Delete"
                        >
                            🗑️
                        </button>
                    {/if}
                </div>
            {/each}
        {/if}
    </div>

    <!-- Input -->
    {#if canComment && !isReadOnly}
        <div
            class="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
        >
            <div class="relative">
                <textarea
                    bind:value={newComment}
                    on:keydown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit();
                        }
                    }}
                    placeholder="Write a comment..."
                    class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none h-20"
                ></textarea>
                <button
                    on:click={handleSubmit}
                    disabled={!newComment.trim() || isSubmitting}
                    class="absolute bottom-2 right-2 p-1 rounded-full text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                >
                    ➤
                </button>
            </div>
            <p class="text-[10px] text-gray-400 mt-1 pl-1">
                Press Enter to send
            </p>
        </div>
    {:else if !canComment && !isReadOnly}
        <div
            class="p-2 text-center text-xs text-gray-500 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700"
        >
            Sign in to comment
        </div>
    {/if}
</div>
