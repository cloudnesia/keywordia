import { json } from '@sveltejs/kit';
import { getGoogleUser, signSession } from '$lib/server/auth';
import prisma from '$lib/server/prisma';

export async function POST({ request, cookies }) {
    const { token } = await request.json();

    if (!token) {
        return json({ error: 'Missing token' }, { status: 400 });
    }

    const payload = await getGoogleUser(token);

    if (!payload) {
        return json({ error: 'Invalid token' }, { status: 401 });
    }

    const { sub: googleId, email, name, picture } = payload;

    let user = await prisma.user.findUnique({
        where: { googleId },
    });

    if (user && picture && user.image !== picture) {
        try {
            user = await prisma.user.update({
                where: { id: user.id },
                data: { image: picture }
            });
        } catch (e) { }
    }

    if (!user) {
        try {
            user = await prisma.user.create({
                data: {
                    googleId,
                    email,
                    name: name || 'User',
                    image: picture,
                },
            });
        } catch (e) {
            // If race condition or email conflict
            user = await prisma.user.findUnique({ where: { googleId } });
            if (!user) return json({ error: 'User creation failed' }, { status: 500 });
        }
    }

    const sessionToken = signSession(user);

    cookies.set('session', sessionToken, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return json({ user });
}
