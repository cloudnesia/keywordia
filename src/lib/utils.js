// Deterministic color generation based on string input
export function getColor(str) {
    if (!str) return 'hsl(0, 0%, 50%)'; // Fallback gray

    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash % 360);
    // Using the same HSL values as MindMapNode.svelte
    return `hsl(${h}, 70%, 85%)`;
}
