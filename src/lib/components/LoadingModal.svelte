<script>
    export let isOpen = false;
    export let message = "Processing...";
</script>

{#if isOpen}
    <div
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
    >
        <div
            class="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border border-white/10 max-w-sm w-full mx-4"
        >
            <!-- Spinner -->
            <div class="relative w-12 h-12">
                <div
                    class="absolute inset-0 border-4 border-gray-200 dark:border-gray-700 rounded-full"
                ></div>
                <div
                    class="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"
                ></div>
            </div>

            <!-- Text -->
            <div class="text-center">
                <h3 class="text-lg font-bold text-gray-900 dark:text-white">
                    {message}
                </h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Please wait a moment...
                </p>
            </div>
        </div>
    </div>
{/if}

<style>
    .animate-spin {
        animation: spin 1s linear infinite;
    }
    .animate-fade-in {
        animation: fadeIn 0.2s ease-out;
    }

    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
</style>
