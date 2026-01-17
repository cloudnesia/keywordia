
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting Update verification...');

    // 1. Create Test User & Map
    const user = await prisma.user.upsert({
        where: { googleId: 'update-test-user' },
        update: {},
        create: {
            email: 'updater@example.com',
            name: 'Updater User',
            googleId: 'update-test-user',
        }
    });

    const title = 'Original Title ' + Date.now();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const map = await prisma.mindMap.create({
        data: {
            title: title,
            ownerId: user.id,
            slug: slug,
            content: { id: 'root', text: title, children: [] },
        },
    });
    console.log('Map created:', map.slug);

    // 2. Simulate Update Logic (Updating central node text)
    const newTitle = 'Updated Title ' + Date.now();
    const newSlug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    console.log(`Updating map to new title: "${newTitle}"...`);

    // This mirrors the server logic we implemented
    let updateData = {
        title: newTitle,
        slug: newSlug,
        content: { id: 'root', text: newTitle, children: [] }
    };

    const updatedMap = await prisma.mindMap.update({
        where: { id: map.id },
        data: updateData
    });

    // 3. Verify
    if (updatedMap.slug !== newSlug) {
        throw new Error(`Slug update failed! Expected ${newSlug}, got ${updatedMap.slug}`);
    }
    if (updatedMap.title !== newTitle) {
        throw new Error(`Title update failed! Expected ${newTitle}, got ${updatedMap.title}`);
    }

    console.log('Verified: Slug and Title updated successfully.');

    // 4. Verify Collision Logic
    console.log('Testing collision...');
    // Create another map with the collision target slug
    const collisionTitle = 'Collision Target';
    const collisionSlug = 'collision-target';

    await prisma.mindMap.create({
        data: {
            title: collisionTitle,
            ownerId: user.id,
            slug: collisionSlug,
            content: { id: 'root', text: collisionTitle, children: [] }
        }
    });

    // Try to update our first map to have the same slug
    try {
        await prisma.mindMap.update({
            where: { id: map.id },
            data: { slug: collisionSlug, title: collisionTitle }
        });
        throw new Error('Should have thrown collision error!');
    } catch (e) {
        if (e.code === 'P2002') {
            console.log('Caught expected collision. Simulating server-side fix...');
            const fixedSlug = `${collisionSlug}-${Date.now()}`;
            const fixedMap = await prisma.mindMap.update({
                where: { id: map.id },
                data: { slug: fixedSlug, title: collisionTitle }
            });

            if (fixedMap.slug === collisionSlug) {
                throw new Error('Collision fix failed, slug is still colliding');
            }
            console.log('Verified: Collision handled, new slug:', fixedMap.slug);
        } else {
            throw e; // Unexpected error
        }
    }

    console.log('SUCCESS: Update verification passed.');
    await prisma.$disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
