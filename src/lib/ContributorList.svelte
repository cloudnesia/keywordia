<script>
    import { getColor } from "./utils";

    export let contributors = [];

    // Helper to get initials
    function getInitials(name) {
        if (!name) return "?";
        return name
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
    }

    // Set of users whose images have failed to load
    let imageLoadFailures = new Set();

    function handleImageError(userId) {
        imageLoadFailures.add(userId);
        imageLoadFailures = imageLoadFailures; // trigger reactivity
    }
</script>

{#if contributors.length > 0}
    <div
        class="fixed top-20 right-4 z-40 flex flex-col items-end pointer-events-none"
    >
        <div
            class="bg-white/10 backdrop-blur-md border border-white/20 p-2 rounded-xl shadow-lg pointer-events-auto transition-all duration-300"
        >
            <div
                class="text-xs font-bold text-gray-500 dark:text-gray-400 mb-2 px-1 uppercase tracking-wider text-right"
            >
                Viewing ({contributors.length})
            </div>
            <div class="flex flex-row gap-2">
                {#each contributors as user (user.socketId || user.id)}
                    <div
                        class="flex items-center justify-center animate-fade-in group relative"
                    >
                        <!-- Tooltip -->
                        <div
                            class="absolute bottom-full mb-2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none"
                        >
                            {user.name}
                        </div>

                        {#if user.image && !imageLoadFailures.has(user.id)}
                            <img
                                src={user.image}
                                alt={user.name}
                                class="w-8 h-8 rounded-full border-2 border-white dark:border-gray-700 shadow-sm object-cover"
                                on:error={() => handleImageError(user.id)}
                            />
                        {:else}
                            <div
                                class="w-8 h-8 rounded-full flex items-center justify-center text-gray-900 text-xs font-bold border-2 border-white dark:border-gray-700 shadow-sm"
                                style="background-color: {getColor(
                                    user.id || user.name || 'default',
                                )}"
                            >
                                {getInitials(user.name)}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>
    </div>
{/if}

<style>
    .animate-fade-in {
        animation: fadeIn 0.3s ease-out;
    }
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(-5px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
</style>
