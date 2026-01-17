
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting verification...');

    // 1. Create/Get Test User
    const user = await prisma.user.upsert({
        where: { googleId: 'test-user-id' },
        update: {},
        create: {
            email: 'test@example.com',
            name: 'Test User',
            googleId: 'test-user-id',
            image: 'https://example.com/avatar.png'
        }
    });
    console.log('Test user ready:', user.id);

    try {
        // 2. Simulate Map Creation Logic (similar to +server.js)
        const title = 'Verification Map ' + Date.now();
        let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        console.log(`Creating map with title "${title}" and expected slug "${slug}"...`);

        const newMap = await prisma.mindMap.create({
            data: {
                title: title,
                ownerId: user.id,
                slug: slug,
                content: { id: 'root', text: title, children: [] },
            },
        });

        // 3. Verify Database State
        console.log('Map created:', newMap.id);

        if (newMap.slug !== slug) {
            throw new Error(`Slug mismatch! Expected ${slug}, got ${newMap.slug}`);
        }

        // Check content central node text
        const content = newMap.content;
        if (content.text !== title) {
            // content might be a string or object depending on prisma version/custom logic, usually object if Json type
            // schema says Json, so it should be object.
            throw new Error(`Central node text mismatch! Expected "${title}", got "${content.text}"`);
        }

        console.log('Verified: Map stored correctly with slug.');

        // 4. Verify Retrieval Logic (similar to +page.server.js)
        console.log(`Attempting to find map by slug "${slug}"...`);
        const foundMap = await prisma.mindMap.findFirst({
            where: {
                OR: [
                    { id: slug }, // Should not match ID obviously
                    { slug: slug }
                ]
            }
        });

        if (!foundMap) {
            throw new Error('Could not find map by slug!');
        }
        if (foundMap.id !== newMap.id) {
            throw new Error('Found wrong map!');
        }

        console.log('Verified: Map found by slug.');
        console.log('SUCCESS: Slug logic verification passed.');

    } catch (e) {
        console.error('Verification FAILED:', e);
        process.exit(1);
    } finally {
        // Cleanup? Maybe leave it for inspection or delete it.
        // Let's delete it to keep it clean.
        // await prisma.mindMap.deleteMany({ where: { slug: { contains: 'verification-map' } } });
        await prisma.$disconnect();
    }
}

main();
