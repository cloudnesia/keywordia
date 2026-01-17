<script>
    import Toolbar from "$lib/Toolbar.svelte";
    import { toasts } from "$lib/stores/toast";
    import { goto } from "$app/navigation";

    export let data;

    async function createMap() {
        if (!data.user) {
            alert("Please login to create a map");
            return;
        }
        try {
            const res = await fetch("/api/map", {
                method: "POST",
                body: JSON.stringify({ title: "New Mind Map" }),
            });
            if (res.ok) {
                const { map } = await res.json();
                goto(`/map/${map.slug || map.id}?focus=root`);
            } else {
                toasts.add("Failed to create map", "error");
            }
        } catch (e) {
            toasts.add("Network error: Failed to create map", "error");
        }
    }
</script>

<div
    class="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center relative overflow-hidden transition-colors duration-500"
>
    <!-- Toolbar only for login/theme on home -->
    <Toolbar user={data.user} />

    <!-- Animated Background Blobs -->
    <div
        class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none"
    >
        <div
            class="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400/20 rounded-full blur-3xl mix-blend-multiply filter animate-blob"
        ></div>
        <div
            class="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl mix-blend-multiply filter animate-blob animation-delay-2000"
        ></div>
        <div
            class="absolute -bottom-8 left-1/3 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl mix-blend-multiply filter animate-blob animation-delay-4000"
        ></div>
    </div>

    <!-- Central Action -->
    <div class="z-10 text-center">
        {#if !data.user}
            <div class="mb-8">
                <h1
                    class="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-4 tracking-tight"
                >
                    Keywordia
                </h1>
                <p
                    class="text-xl text-gray-500 dark:text-gray-400 dark:bg-gray-800/50 rounded-full px-4 py-1"
                >
                    Visualize your ideas, instantly.
                </p>
            </div>
            <div class="animate-bounce">
                <p class="text-gray-400 dark:text-gray-500 mb-2">
                    Login to Start
                </p>
                <div class="text-4xl">☝️</div>
                <!-- Arrow pointing to toolbar login or just assume user sees toolbar -->
            </div>
        {:else}
            <button
                on:click={createMap}
                class="group relative flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 shadow-2xl hover:scale-110 transition-transform duration-300 mx-auto"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="1.5"
                    stroke="currentColor"
                    class="w-16 h-16 text-white transition-transform duration-500 group-hover:rotate-90"
                >
                    <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                    />
                </svg>
            </button>
            <p
                class="mt-6 text-lg text-gray-600 dark:text-gray-300 font-medium tracking-wide"
            >
                Create New Mind Map
            </p>

            {#if data.maps.length > 0}
                <div
                    class="mt-12 w-full max-w-md bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-gray-100 dark:border-gray-700 max-h-60 overflow-y-auto"
                >
                    <h3
                        class="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 text-left px-2"
                    >
                        Recent Maps
                    </h3>
                    <ul class="space-y-2">
                        {#each data.maps as map}
                            <li>
                                <a
                                    href="/map/{map.id}"
                                    class="block p-3 rounded-lg hover:bg-white dark:hover:bg-gray-700 transition-colors text-left flex justify-between items-center group"
                                >
                                    <span
                                        class="font-medium text-gray-800 dark:text-gray-200"
                                        >{map.title}</span
                                    >
                                    <span
                                        class="text-xs text-gray-400 group-hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >Open →</span
                                    >
                                </a>
                            </li>
                        {/each}
                    </ul>
                </div>
            {/if}
        {/if}
    </div>
</div>

<style>
    .animate-blob {
        animation: blob 7s infinite;
    }
    .animation-delay-2000 {
        animation-delay: 2s;
    }
    .animation-delay-4000 {
        animation-delay: 4s;
    }
    @keyframes blob {
        0% {
            transform: translate(0px, 0px) scale(1);
        }
        33% {
            transform: translate(30px, -50px) scale(1.1);
        }
        66% {
            transform: translate(-20px, 20px) scale(0.9);
        }
        100% {
            transform: translate(0px, 0px) scale(1);
        }
    }
</style>
