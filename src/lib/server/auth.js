import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';

const { PUBLIC_GOOGLE_CLIENT_ID } = publicEnv;
const { GOOGLE_CLIENT_SECRET, JWT_SECRET } = privateEnv;

const client = new OAuth2Client(PUBLIC_GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);

export const verifyGoogleToken = async (token) => {
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: PUBLIC_GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        return payload;
    } catch (error) {
        console.error('Error verifying Google token:', error);
        return null;
    }
};

export const signSession = (user) => {
    return jwt.sign({ id: user.id, email: user.email, name: user.name, image: user.image }, JWT_SECRET, {
        expiresIn: '7d',
    });
};

export const verifySession = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
};
