import { writable, get } from 'svelte/store';

export const mindMap = writable({
    id: 'root',
    text: 'Central Topic',
    children: []
});

export const isReadOnly = writable(false);
export const layout = writable('left-to-right'); // 'top-down' or 'left-to-right'
export const focusedNodeId = writable(null); // Track node to auto-focus

// Theme based on OS preference
export const theme = writable('light');
export const currentUser = writable(null);
export const mapOwnerId = writable(null);
export const isPresentationMode = writable(false);
export const presentationSignal = writable(0);

if (typeof window !== 'undefined') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateTheme = (e) => {
        const newTheme = e.matches ? 'dark' : 'light';
        theme.set(newTheme);
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };
    updateTheme(mediaQuery); // Initial set
    mediaQuery.addEventListener('change', updateTheme);
}

// Helper to find and update a node in the tree
const updateNodeRecursive = (node, id, updater) => {
    if (node.id === id) {
        return updater(node);
    }
    if (node.children) {
        return {
            ...node,
            children: node.children.map(child => updateNodeRecursive(child, id, updater))
        };
    }
    return node;
};

// Helper to add a child
const addChildRecursive = (node, parentId, newChild) => {
    if (node.id === parentId) {
        return {
            ...node,
            children: [...(node.children || []), newChild]
        };
    }
    if (node.children) {
        return {
            ...node,
            children: node.children.map(child => addChildRecursive(child, parentId, newChild))
        };
    }
    return node;
};

// Helper to delete a node
const deleteNodeRecursive = (node, id) => {
    if (node.children) {
        return {
            ...node,
            children: node.children
                .filter(child => child.id !== id)
                .map(child => deleteNodeRecursive(child, id))
        };
    }
    return node;
};

// Helper to add sibling
const addSiblingRecursive = (node, childId, newSibling) => {
    if (node.children) {
        const index = node.children.findIndex(c => c.id === childId);
        if (index !== -1) {
            const newChildren = [...node.children];
            newChildren.splice(index + 1, 0, newSibling);
            return {
                ...node,
                children: newChildren
            };
        }
        return {
            ...node,
            children: node.children.map(child => addSiblingRecursive(child, childId, newSibling))
        };
    }
    return node;
};

export const updateNodeText = (id, text) => {
    mindMap.update(tree => updateNodeRecursive(tree, id, n => ({ ...n, text })));
};

export const addChild = (parentId) => {
    recordHistory();
    const id = crypto.randomUUID();
    const user = get(currentUser);
    const newChild = {
        id,
        text: 'New Node',
        children: [],
        createdBy: user ? {
            id: user.id,
            image: user.image,
            name: user.name
        } : null
    };
    mindMap.update(tree => addChildRecursive(tree, parentId, newChild));
    focusedNodeId.set(id); // Set focus to the new node
};

export const deleteNode = (id) => {
    if (id === 'root') return; // Cannot delete root
    recordHistory();
    mindMap.update(tree => deleteNodeRecursive(tree, id));
};

export const addSibling = (siblingId) => {
    if (siblingId === 'root') return; // Root has no siblings
    recordHistory();
    const id = crypto.randomUUID();
    const user = get(currentUser);
    const newSibling = {
        id,
        text: 'New Node',
        children: [],
        createdBy: user ? {
            id: user.id,
            image: user.image,
            name: user.name
        } : null
    };
    mindMap.update(tree => addSiblingRecursive(tree, siblingId, newSibling));
    focusedNodeId.set(id);
};

export const setMap = (data) => {
    mindMap.set(data);
}

// --- History / Undo-Redo System ---

export const history = writable({
    past: [],
    future: []
});

let snapshot = null; // Temp storage for transaction

// Record the current state into history before making a change
export const recordHistory = () => {
    const currentState = get(mindMap);
    history.update(h => ({
        past: [...h.past, structuredClone(currentState)],
        future: []
    }));
};

export const startTransaction = () => {
    snapshot = structuredClone(get(mindMap));
};

export const commitTransaction = () => {
    if (snapshot) {
        history.update(h => ({
            past: [...h.past, snapshot],
            future: []
        }));
        snapshot = null;
    }
};

export const discardTransaction = () => {
    snapshot = null;
};

export const undo = () => {
    discardTransaction();
    const h = get(history);
    const user = get(currentUser);
    const ownerId = get(mapOwnerId);

    // Only owner can undo
    if (!user || !ownerId || user.id !== ownerId) return;

    if (h.past.length === 0) return;

    const previous = h.past[h.past.length - 1];
    const newPast = h.past.slice(0, h.past.length - 1);
    const current = get(mindMap);

    mindMap.set(previous);
    history.set({
        past: newPast,
        future: [current, ...h.future]
    });
};

export const redo = () => {
    discardTransaction();
    const h = get(history);
    const user = get(currentUser);
    const ownerId = get(mapOwnerId);

    // Only owner can redo
    if (!user || !ownerId || user.id !== ownerId) return;

    if (h.future.length === 0) return;

    const next = h.future[0];
    const newFuture = h.future.slice(1);
    const current = get(mindMap);

    mindMap.set(next);
    history.set({
        past: [...h.past, current],
        future: newFuture
    });
};
