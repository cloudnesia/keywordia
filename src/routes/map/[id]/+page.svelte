<script>
    import Toolbar from "$lib/Toolbar.svelte";
    import MindMapNode from "$lib/MindMapNode.svelte";
    import {
        mindMap,
        focusedNodeId,
        isReadOnly,
        setMap,
        currentUser,
        mapOwnerId,
        isPresentationMode,
        comments,
        activeCommentNodeId,
    } from "$lib/store";
    import { page } from "$app/stores";
    import { onMount, onDestroy } from "svelte";
    import { io } from "socket.io-client";

    import ContributorList from "$lib/ContributorList.svelte";

    export let data;

    let socket;
    let isRemoteUpdate = false;
    let lastLocalChange = 0;
    let contributors = [];

    // Sync User and Owner to Store
    $: if (data) {
        currentUser.set(data.user);
        if (data.map) {
            mapOwnerId.set(data.map.ownerId);
        }
    }

    // Sync Map Data to Store
    $: if (data.map) {
        isRemoteUpdate = true;
        if (typeof data.map.content === "string") {
            try {
                setMap(JSON.parse(data.map.content));
            } catch (e) {
                console.error("Failed to parse map content", e);
            }
        } else {
            setMap(data.map.content);
        }
        isRemoteUpdate = false;
        isReadOnly.set(data.isReadOnly);
        // Default to Presentation Mode if read-only
        if (data.isReadOnly) {
            isPresentationMode.set(true);
        }
    } else {
        // Fallback for new empty map if needed (though map usually exists)
        isRemoteUpdate = true;
        setMap({ id: "root", text: "Central Topic", children: [] });
        isRemoteUpdate = false;
    }

    // Subscribe to track ONLY local user changes
    const unsubscribe = mindMap.subscribe(() => {
        if (!isRemoteUpdate) {
            lastLocalChange = Date.now();
        }
    });

    // Fetch latest map data
    async function fetchMap() {
        if (!data.map.id) return;
        try {
            const res = await fetch(`/api/map/${data.map.id}`, {
                headers: { Pragma: "no-cache", "Cache-Control": "no-cache" },
            });
            if (res.ok) {
                const fetchedMap = await res.json();
                const remoteMap = fetchedMap.map;

                const currentContentStr = JSON.stringify($mindMap);
                let newContentStr = "";
                let newContentObj = null;

                if (typeof remoteMap.content === "string") {
                    newContentStr = remoteMap.content;
                    try {
                        newContentObj = JSON.parse(newContentStr);
                    } catch (e) {}
                } else {
                    newContentStr = JSON.stringify(remoteMap.content);
                    newContentObj = remoteMap.content;
                }

                if (newContentStr !== currentContentStr && newContentObj) {
                    // Don't overwrite if local changes happened very recently (2s)
                    if (Date.now() - lastLocalChange < 2000) return;

                    isRemoteUpdate = true;
                    setMap(newContentObj);
                    isRemoteUpdate = false;
                }
            }
        } catch (e) {
            console.error("Fetch map error", e);
        }
    }

    async function fetchComments() {
        if (!data.map.id) return;
        try {
            const res = await fetch(`/api/comments?mindMapId=${data.map.id}`);
            if (res.ok) {
                const fetchedComments = await res.json();
                // Group by nodeId
                const grouped = {};
                fetchedComments.forEach((c) => {
                    if (!grouped[c.nodeId]) grouped[c.nodeId] = [];
                    grouped[c.nodeId].push(c);
                });
                comments.set(grouped);
            }
        } catch (e) {
            console.error("Fetch comments error", e);
        }
    }

    onMount(() => {
        if ($page.url.searchParams.get("focus") === "root") {
            focusedNodeId.set("root");
        }

        fetchComments();

        // Initialize Socket.IO
        socket = io();

        socket.on("connect", () => {
            console.log("Connected to WebSocket");
            if (data.map.id) {
                // Pass user data when joining
                const user = {
                    id: data.user?.id,
                    name: data.user?.name,
                    image: data.user?.image,
                };
                socket.emit("join-map", data.map.id, user);
            }
        });

        socket.on("map-updated", () => {
            console.log("Map updated, fetching...");
            fetchMap();
        });

        socket.on("contributors-updated", (users) => {
            contributors = users;
        });

        socket.on("comment-added", (comment) => {
            comments.update((all) => {
                const nodeComments = all[comment.nodeId] || [];
                return {
                    ...all,
                    [comment.nodeId]: [comment, ...nodeComments], // Descending order usually, but here we prepend newly created
                };
            });
        });

        socket.on("comment-deleted", (id) => {
            comments.update((all) => {
                const newAll = { ...all };
                for (const nodeId in newAll) {
                    newAll[nodeId] = newAll[nodeId].filter((c) => c.id !== id);
                }
                return newAll;
            });
        });
    });

    onDestroy(() => {
        if (socket) socket.disconnect();
        unsubscribe();
    });

    let pan = { x: 0, y: 0 };
    let isPanning = false;
    let startPos = { x: 0, y: 0 };
    let activeCommentId;

    // Subscribe to store to know active comment
    // Subscribe to store to know active comment
    comments.subscribe(() => {}); // Just to ensure store is active if needed (though we need activeCommentNodeId actually)
    activeCommentNodeId.subscribe((val) => (activeCommentId = val));

    function handleMouseDown(e) {
        // Only pan if clicking on the background (not toolbar, nodes, etc which stop propagation)
        // We can check target or rely on inner elements stopping propagation.
        // MindMapNode seems to stop propagation on clicks?
        // MindMapNode: on:click|stopPropagation={handleNodeClick}
        // Yes.
        if (e.button !== 0) return; // Only left click
        isPanning = true;
        startPos = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }

    function handleMouseMove(e) {
        if (!isPanning) return;
        pan = {
            x: e.clientX - startPos.x,
            y: e.clientY - startPos.y,
        };
    }

    function handleMouseUp() {
        isPanning = false;
    }

    function handleBackgroundClick(e) {
        // If we were panning (moved significantly), don't treat as click?
        // Actually click event usually fires after mouseup.
        // We can check if isPanning was just true? No, mouseup sets it false.
        // But usually clicks on background are for closing things.

        // Close comment box if open
        if (activeCommentId) {
            activeCommentNodeId.set(null);
        }
    }
</script>

<div
    class="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden relative select-none"
    on:mousedown={handleMouseDown}
    on:mousemove={handleMouseMove}
    on:mouseup={handleMouseUp}
    on:mouseleave={handleMouseUp}
    on:click={handleBackgroundClick}
    role="button"
    tabindex="0"
    on:keydown={() => {}}
    style="cursor: {isPanning ? 'grabbing' : 'grab'};"
>
    <!-- Contributor List -->
    <ContributorList {contributors} />

    <Toolbar
        user={data.user}
        mapId={data.map.id}
        mapSlug={data.map.slug}
        canEdit={!data.isReadOnly}
        isEditable={data.map.isEditable}
        isOwner={data.isOwner}
    />

    <div
        class="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none"
    >
        <!-- Map Container: movable -->
        <!-- Pointer events auto on children, none on wrapper to let clicks pass to background? 
             Wait, we want clicks on background to pan. 
             If wrapper is pointer-events-none, clicks go to background div? Yes.
             But children (nodes) need pointer-events-auto.
        -->
        <div
            id="map-container"
            class="p-8 transition-transform duration-75 pointer-events-auto"
            style="transform: translate({pan.x}px, {pan.y}px);"
        >
            <MindMapNode
                node={$mindMap}
                isRoot={true}
                mindMapId={data.map.id}
            />
        </div>
    </div>
</div>
