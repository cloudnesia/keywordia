import { json } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';

export async function GET({ params, locals }) {
    const { id } = params;

    const map = await prisma.mindMap.findUnique({
        where: { id },
    });

    if (!map) {
        return json({ error: 'Not found' }, { status: 404 });
    }

    // Allow if owner or public (or just allow all for guests)
    // if (map.ownerId !== locals.user?.id && !map.isPublic) {
    //    return json({ error: 'Unauthorized' }, { status: 403 });
    // }

    const isOwner = map.ownerId === locals.user?.id;

    return json({ map, isReadOnly: !isOwner });
}

export async function PUT({ params, request, locals }) {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const { content, title, isPublic } = await request.json();

    const map = await prisma.mindMap.findUnique({
        where: { id },
        include: { collaborators: true }
    });

    if (!map) {
        return json({ error: 'Not found' }, { status: 404 });
    }

    const isOwner = locals.user && map.ownerId === locals.user.id;
    const isCollaborator = locals.user && map.collaborators.some(c => c.id === locals.user.id);
    const isEditable = map.isEditable;

    if (!isOwner && !isCollaborator && !isEditable) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    let updateData = {
        content: content !== undefined ? content : undefined,
        title: title !== undefined ? title : undefined,
        isPublic: isPublic !== undefined ? isPublic : undefined,
    };

    // If content is being updated, check if we need to sync title and slug from central node
    if (content && content.text) {
        const newTitle = content.text.trim();
        // Only update if the title effectively changed and it's not empty
        if (newTitle && newTitle !== map.title) {
            updateData.title = newTitle;

            // Generate new slug
            let slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            if (!slug) slug = crypto.randomUUID();
            updateData.slug = slug;
        }
    }

    try {
        const updatedMap = await prisma.mindMap.update({
            where: { id },
            data: updateData,
        });

        // Notify connected clients via WebSocket
        if (global.io) {
            global.io.to(id).emit('map-updated');
        }

        return json({ map: updatedMap });

    } catch (e) {
        // Handle Slug Collision
        if (e.code === 'P2002' && updateData.slug) {
            const newSlug = `${updateData.slug}-${Date.now()}`;
            updateData.slug = newSlug;

            const updatedMap = await prisma.mindMap.update({
                where: { id },
                data: updateData,
            });

            if (global.io) {
                global.io.to(id).emit('map-updated');
            }
            return json({ map: updatedMap });
        }
        throw e;
    }
}
