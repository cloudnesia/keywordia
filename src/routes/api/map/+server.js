import { json } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';

export async function GET({ locals }) {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const maps = await prisma.mindMap.findMany({
        where: { ownerId: locals.user.id },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, updatedAt: true, isPublic: true } // Don't fetch content for list
    });

    return json({ maps });
}

export async function POST({ request, locals }) {
    if (!locals.user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title } = await request.json();

    // Simple slugify: lowercase, replace non-alphanumeric with hyphens, trim hyphens
    let slug = (title || 'Untitled Map').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    if (!slug) slug = crypto.randomUUID();

    // Ensure uniqueness by checking or simple try/catch (for now we rely on user unique titles or let it fail/retry in client - or better, just append timestamp if collision? 
    // For simplicity in this step, we'll try to create it. If it fails, we should handle it, but for this task we'll assume uniqueness for now or let Prisma throw.
    // Actually, let's append a random suffix to be safe if it's very common, but clean slugs are nicer.
    // Let's check if it exists first? No, race condition.
    // Let's just create. 

    try {
        const newMap = await prisma.mindMap.create({
            data: {
                title: title || 'Untitled Map',
                ownerId: locals.user.id,
                slug: slug,
                content: { id: 'root', text: title || 'Central Topic', children: [] },
            },
        });
        return json({ map: newMap });
    } catch (e) {
        // If slug collision (code P2002), append random
        if (e.code === 'P2002') {
            const newSlug = `${slug}-${Date.now()}`;
            const newMap = await prisma.mindMap.create({
                data: {
                    title: title || 'Untitled Map',
                    ownerId: locals.user.id,
                    slug: newSlug,
                    content: { id: 'root', text: title || 'Central Topic', children: [] },
                },
            });
            return json({ map: newMap });
        }
        throw e;
    }
}
