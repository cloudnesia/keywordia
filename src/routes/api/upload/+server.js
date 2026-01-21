import { json } from '@sveltejs/kit';
import fs from 'fs';
import path from 'path';
import prisma from '$lib/server/prisma';
import { promises as fsPromises } from 'fs';

export async function POST({ request, locals }) {
    // Basic User check - customize as needed
    // const user = locals.user;
    // if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || !file.name) {
            return json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const uploadDir = path.resolve('static/uploads');

        // Ensure directory exists
        await fsPromises.mkdir(uploadDir, { recursive: true });

        // Generate unique filename
        const ext = path.extname(file.name);
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
        const filePath = path.join(uploadDir, uniqueName);

        // Write file
        await fsPromises.writeFile(filePath, buffer);

        // Public URL
        const url = `/uploads/${uniqueName}`;

        // Optional: Save to DB
        // await prisma.asset.create({
        //     data: {
        //         url,
        //         filename: file.name,
        //         mimetype: file.type,
        //         size: file.size,
        //         userId: user?.id
        //     }
        // });

        return json({ url });
    } catch (err) {
        console.error('Upload Error:', err);
        return json({ error: 'Upload failed' }, { status: 500 });
    }
}
