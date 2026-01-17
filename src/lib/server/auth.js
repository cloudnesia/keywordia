import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';

const { PUBLIC_GOOGLE_CLIENT_ID } = publicEnv;
const { GOOGLE_CLIENT_SECRET, JWT_SECRET } = privateEnv;

const client = new OAuth2Client(PUBLIC_GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);

export const getGoogleUser = async (accessToken) => {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user info');
        }

        const data = await response.json();
        return data; // contains sub, name, email, picture
    } catch (error) {
        console.error('Error fetching Google user:', error);
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
