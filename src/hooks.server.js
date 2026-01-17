import { verifySession } from '$lib/server/auth';
import prisma from '$lib/server/prisma';

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
    const token = event.cookies.get('session');

    if (token) {
        const sessionUser = verifySession(token);
        if (sessionUser) {
            const user = await prisma.user.findUnique({
                where: { id: sessionUser.id }
            });

            if (user) {
                event.locals.user = user;
            } else {
                // Token valid but user not in DB (stale session). Clear cookie.
                event.cookies.delete('session', { path: '/' });
            }
        }
    }

    const response = await resolve(event);
    return response;
}
