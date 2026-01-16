<script>
    import { createEventDispatcher } from "svelte";
    import { scale, fade } from "svelte/transition";
    import { toasts } from "./stores/toast";

    export let isOpen = false;
    export let url = "";
    export let mapId = "";
    export let isEditable = false;
    export let user = null;

    async function togglePublicEdit() {
        try {
            const res = await fetch(`/api/map/${mapId}/settings`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isEditable: !isEditable }),
            });
            if (res.ok) {
                isEditable = !isEditable;
                toasts.add(
                    isEditable
                        ? "Public editing enabled"
                        : "Public editing disabled",
                    "success",
                );
            } else {
                toasts.add("Failed to update settings", "error");
            }
        } catch (e) {
            toasts.add("Network error", "error");
        }
    }
    export let collaborators = [];

    const dispatch = createEventDispatcher();

    function close() {
        dispatch("close");
    }

    function copyToClipboard() {
        navigator.clipboard.writeText(url);
        toasts.add("Link copied to clipboard", "success");
    }

    let inviteEmail = "";
    let isInviting = false;

    async function handleInvite() {
        if (!inviteEmail) return;
        isInviting = true;
        try {
            const res = await fetch(`/api/map/${mapId}/collaborator`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: inviteEmail }),
            });
            const data = await res.json();
            if (res.ok) {
                toasts.add(`Invited ${inviteEmail}`, "success");
                collaborators = [...collaborators, data.user];
                inviteEmail = "";
            } else {
                toasts.add(data.error || "Failed to invite", "error");
            }
        } catch (e) {
            toasts.add("Network error", "error");
        }
        isInviting = false;
    }

    async function removeCollaborator(userId) {
        try {
            const res = await fetch(`/api/map/${mapId}/collaborator`, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId }),
            });
            if (res.ok) {
                collaborators = collaborators.filter((c) => c.id !== userId);
                toasts.add("Removed collaborator", "success");
            } else {
                toasts.add("Failed to remove", "error");
            }
        } catch (e) {
            toasts.add("Network error", "error");
        }
    }
</script>

{#if isOpen}
    <div
        class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        transition:fade
    >
        <div
            class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-100 dark:border-gray-700"
            transition:scale
        >
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold text-gray-900 dark:text-white">
                    Share Mind Map
                </h3>
                <button
                    on:click={close}
                    class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
                >
                    ✕
                </button>
            </div>

            <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Share this link with others to view or edit this mind map.
            </p>

            <div class="flex gap-2 mb-6">
                <input
                    type="text"
                    value={url}
                    readonly
                    class="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                />
                <button
                    on:click={copyToClipboard}
                    class="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-5 py-2.5 transition-colors cursor-pointer"
                >
                    Copy
                </button>
            </div>

            {#if user}
                <div
                    class="flex items-center justify-between mb-4 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg"
                >
                    <div class="flex flex-col">
                        <span
                            class="text-sm font-medium text-gray-900 dark:text-white"
                            >Public Editing</span
                        >
                        <span class="text-xs text-gray-500 dark:text-gray-400"
                            >Anyone with the link can edit</span
                        >
                    </div>
                    <label
                        class="relative inline-flex items-center cursor-pointer"
                    >
                        <input
                            type="checkbox"
                            value=""
                            class="sr-only peer"
                            checked={isEditable}
                            on:change={togglePublicEdit}
                        />
                        <div
                            class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"
                        ></div>
                    </label>
                </div>

                <!-- <div
                    class="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4"
                >
                    <h4
                        class="text-sm font-bold text-gray-900 dark:text-gray-200 mb-2"
                    >
                        Collaborators
                    </h4>
                    <div class="flex gap-2 mb-4">
                        <input
                            type="email"
                            bind:value={inviteEmail}
                            placeholder="Enter email to invite..."
                            class="flex-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                        />
                        <button
                            on:click={handleInvite}
                            disabled={isInviting}
                            class="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm px-4 py-2.5 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {isInviting ? "..." : "Invite"}
                        </button>
                    </div>

                    <ul class="space-y-2 max-h-40 overflow-y-auto">
                        {#each collaborators as user (user.id)}
                            <li
                                class="flex justify-between items-center text-sm p-2 bg-gray-50 dark:bg-gray-900 rounded"
                            >
                                <span class="text-gray-800 dark:text-gray-200"
                                    >{user.email}</span
                                >
                                <button
                                    on:click={() => removeCollaborator(user.id)}
                                    class="text-red-500 hover:text-red-700 cursor-pointer"
                                    >Remove</button
                                >
                            </li>
                        {:else}
                            <li class="text-gray-400 text-xs italic">
                                No collaborators yet.
                            </li>
                        {/each}
                    </ul>
                </div> -->
            {/if}

            <div class="flex justify-end">
                <button
                    on:click={close}
                    class="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-gray-100 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-gray-800 dark:text-white dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:focus:ring-gray-700 cursor-pointer"
                >
                    Close
                </button>
            </div>
        </div>
    </div>
{/if}
