// lib/facebook-api.js
// Handles Facebook Graph API calls

export class FacebookAPI {
    static async postText(pageId, pageAccessToken, message) {
        const url = `https://graph.facebook.com/v19.0/${pageId}/feed`;
        const params = new URLSearchParams({
            message: message,
            access_token: pageAccessToken
        });

        const response = await fetch(`${url}?${params.toString()}`, {
            method: 'POST'
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to post text');
        }
        return data.id;
    }

    static async postPhoto(pageId, pageAccessToken, message, imageUrlOrBase64) {
        const url = `https://graph.facebook.com/v19.0/${pageId}/photos`;
        
        let formData = new FormData();
        formData.append('caption', message);
        formData.append('access_token', pageAccessToken);

        if (imageUrlOrBase64.startsWith('data:image')) {
            // Handle Base64
            const blob = await (await fetch(imageUrlOrBase64)).blob();
            formData.append('source', blob);
        } else {
            // Handle URL
            formData.append('url', imageUrlOrBase64);
        }

        const response = await fetch(url, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to post photo');
        }
        return data.id;
    }
}
