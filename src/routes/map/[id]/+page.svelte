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
    import LoadingModal from "$lib/components/LoadingModal.svelte";

    export let data;

    let socket;
    let isRemoteUpdate = false;
    let lastLocalChange = 0;
    let contributors = [];
    let isMapLoaded = false;

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

        // Simulate loading briefly or wait for data?
        // Data is passed from server (data.map), so it's technically "loaded" structure-wise.
        // But we want to prevent interaction until hydration/mounting is stable.
        setTimeout(() => {
            isMapLoaded = true;
        }, 800);

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
    let scale = 1;
    let isPanning = false;
    let isPinching = false;
    let lastMousePos = { x: 0, y: 0 };
    let lastTouchCenter = { x: 0, y: 0 };
    let lastTouchDistance = 0;

    let activeCommentId;

    // Subscribe to store to know active comment
    comments.subscribe(() => {});
    activeCommentNodeId.subscribe((val) => (activeCommentId = val));

    function handleMouseDown(e) {
        if (e.button !== 0) return; // Only left click
        isPanning = true;
        lastMousePos = { x: e.clientX, y: e.clientY };
    }

    function handleMouseMove(e) {
        if (!isPanning) return;
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        lastMousePos = { x: e.clientX, y: e.clientY };
        pan = { x: pan.x + dx, y: pan.y + dy };
    }

    function handleMouseUp() {
        isPanning = false;
    }

    function handleWheel(e) {
        // e.preventDefault() is handled by Svelte modifier
        const zoomIntensity = 0.1;
        const direction = e.deltaY < 0 ? 1 : -1;
        const factor = 1 + zoomIntensity * direction;

        const rect = e.currentTarget.getBoundingClientRect();
        // Mouse relative to container (viewport) is just clientX/Y because container covers screen
        // But let's be safe if container has offset (it shouldn't in this layout)
        const mouseX = e.clientX;
        const mouseY = e.clientY;

        zoom(factor, { x: mouseX, y: mouseY });
    }

    function zoom(factor, center) {
        const minScale = 0.1;
        const maxScale = 5;
        let newScale = scale * factor;

        // Clamp scale
        if (newScale < minScale) newScale = minScale;
        if (newScale > maxScale) newScale = maxScale;

        // Recalculate factor in case it was clamped
        const actualFactor = newScale / scale;

        // Adjust pan to zoom towards center
        pan = {
            x: center.x - (center.x - pan.x) * actualFactor,
            y: center.y - (center.y - pan.y) * actualFactor,
        };
        scale = newScale;
    }

    // Touch Handlers
    function handleTouchStart(e) {
        if (e.touches.length === 1) {
            isPanning = true;
            isPinching = false;
            lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
            isPanning = false;
            isPinching = true;
            lastTouchDistance = getDistance(e.touches);
            lastTouchCenter = getCenter(e.touches);
        }
    }

    function handleTouchMove(e) {
        e.preventDefault(); // Prevent scrolling the page

        if (isPanning && e.touches.length === 1) {
            const dx = e.touches[0].clientX - lastMousePos.x;
            const dy = e.touches[0].clientY - lastMousePos.y;
            lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            pan = { x: pan.x + dx, y: pan.y + dy };
        } else if (isPinching && e.touches.length === 2) {
            const currentDistance = getDistance(e.touches);
            const currentCenter = getCenter(e.touches);

            // 1. Pan by center movement
            const dx = currentCenter.x - lastTouchCenter.x;
            const dy = currentCenter.y - lastTouchCenter.y;
            pan = { x: pan.x + dx, y: pan.y + dy };

            // 2. Zoom
            if (lastTouchDistance > 0) {
                const factor = currentDistance / lastTouchDistance;
                zoom(factor, currentCenter);
            }

            lastTouchDistance = currentDistance;
            lastTouchCenter = currentCenter;
        }
    }

    function handleTouchEnd(e) {
        if (e.touches.length === 0) {
            isPanning = false;
            isPinching = false;
        } else if (e.touches.length === 1) {
            // Switch back to panning if one finger remains?
            // Usually feels better to reset state to avoid jump
            isPanning = true;
            isPinching = false;
            lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    }

    function getDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function getCenter(touches) {
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2,
        };
    }

    function handleBackgroundClick(e) {
        if (activeCommentId) {
            activeCommentNodeId.set(null);
        }
    }
</script>

<div
    class="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden relative select-none touch-none"
    on:mousedown={handleMouseDown}
    on:mousemove={handleMouseMove}
    on:mouseup={handleMouseUp}
    on:mouseleave={handleMouseUp}
    on:wheel|preventDefault={handleWheel}
    on:touchstart={handleTouchStart}
    on:touchmove|nonpassive={handleTouchMove}
    on:touchend={handleTouchEnd}
    on:click={handleBackgroundClick}
    role="button"
    tabindex="0"
    on:keydown={() => {}}
    style="cursor: {isPanning ? 'grabbing' : 'grab'};"
>
    {#if !isMapLoaded}
        <div
            class="fixed inset-0 z-[100] bg-gray-50 dark:bg-gray-900 pointer-events-auto"
        >
            <LoadingModal isOpen={true} message="Loading Mind Map..." />
        </div>
    {/if}

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
            class="p-8 transition-transform duration-0 pointer-events-auto origin-top-left"
            style="transform: translate({pan.x}px, {pan.y}px) scale({scale});"
        >
            <MindMapNode
                node={$mindMap}
                isRoot={true}
                mindMapId={data.map.id}
            />
        </div>
    </div>
</div>
