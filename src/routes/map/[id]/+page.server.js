import prisma from '$lib/server/prisma';
import { error } from '@sveltejs/kit';

export async function load({ params, locals }) {
    const map = await prisma.mindMap.findFirst({
        where: {
            OR: [
                { id: params.id },
                { slug: params.id }
            ]
        },
        include: { collaborators: true }
    });

    if (!map) throw error(404, 'Map not found');

    const user = locals.user; // Define user here
    const isOwner = user && map.ownerId === user.id;
    const isCollaborator = map.collaborators.some(c => c.id === user?.id);
    const isEditable = map.isEditable;
    const isReadOnly = !isOwner && !isCollaborator && !isEditable;

    // Allow access to everyone with the link (read-only for non-owners)
    // if (!map.isPublic && !isOwner) {
    //    throw error(403, 'Unauthorized');
    // }

    return {
        map,
        user,
        isOwner,
        isReadOnly: !user || (!isOwner && !isCollaborator && !isEditable)
    };
}
