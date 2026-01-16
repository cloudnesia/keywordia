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

    onMount(() => {
        if ($page.url.searchParams.get("focus") === "root") {
            focusedNodeId.set("root");
        }

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
    });

    onDestroy(() => {
        if (socket) socket.disconnect();
        unsubscribe(); // Clean up subscription
    });
</script>

<div
    class="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-auto transition-colors duration-300 relative"
>
    <!-- Contributor List -->
    <ContributorList {contributors} />

    <Toolbar
        user={data.user}
        mapId={data.map.id}
        canEdit={!data.isReadOnly}
        isEditable={data.map.isEditable}
        isOwner={data.isOwner}
    />

    <div class="pt-32 pb-20 px-8 flex justify-center min-w-max">
        <MindMapNode node={$mindMap} isRoot={true} />
    </div>
</div>
