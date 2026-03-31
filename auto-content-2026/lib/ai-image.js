// lib/ai-image.js
// Handles AI Image Generation (Hugging Face / Gemini)

export class AiImage {
    static async generatePrompt(textProvider, textApiKey, postContent, style) {
        // ... (Generates an English image prompt from Thai post text)
        const promptGen = `Based on this Facebook post in Thai:\n"${postContent}"\n\nCreate a concise, high-quality image generation prompt in English that represents the key theme of this news. 
        Style: ${style}. 
        Output ONLY the English prompt text, no other words.`;

        // We use the same AiComposer logic but with a specific prompt
        try {
            // Import dynamically to avoid circular dependency in some environments, but 
            // since we are in ES modules and background.js imports them together, it's fine.
            // However, to keep it simple, we use the provider call directly or re-import.
            // In sidepanel.js/background.js, we will have AiComposer already.
            
            // For now, let's assume we pass the generated prompt back.
            // Actually, we can just call the API here directly if we want to be independent.
            return await this._callAiForPrompt(textProvider, textApiKey, promptGen);
        } catch (error) {
            console.error('[AiImage Prompt Gen Error]', error);
            return "A professional news illustration, high quality, 4k";
        }
    }

    static async _callAiForPrompt(provider, apiKey, prompt) {
        // Simplified version of AiComposer call
        if (provider === 'gemini') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            const data = await res.json();
            return data.candidates[0].content.parts[0].text.trim();
        } else {
            // Groq/OpenRouter fallback (using OpenAI compatible endpoint)
            const url = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://openrouter.ai/api/v1/chat/completions';
            const model = provider === 'groq' ? "llama-3.3-70b-versatile" : "anthropic/claude-3-haiku";
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: model, messages: [{ role: "user", content: prompt }] })
            });
            const data = await res.json();
            return data.choices[0].message.content.trim();
        }
    }

    static async generateImage(geminiKey, hfKey, provider, prompt, ratio = '1:1') {
        if (provider === 'huggingface') {
            return await this.callHuggingFace(hfKey, prompt, ratio);
        } else {
            // Gemini (Standard Imagen integration placeholder)
            throw new Error('ระบบ Imagen ใน Gemini ยังอยู่ระหว่างรอการอนุมัติ API ขอแนะนำให้ใช้ Hugging Face ไปก่อนครับ');
        }
    }

    static async callHuggingFace(apiKey, prompt, ratio) {
        // Use FLUX.1[schnell] via HF Inference API - FREE and HIGH QUALITY
        const modelId = "black-forest-labs/FLUX.1-schnell";
        const url = `https://router.huggingface.co/hf-inference/models/${modelId}`;
        
        console.log(`[AiImage] Calling Hugging Face with prompt: ${prompt}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ inputs: prompt })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Hugging Face Error: ${err}`);
        }

        const blob = await response.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });
    }
}
