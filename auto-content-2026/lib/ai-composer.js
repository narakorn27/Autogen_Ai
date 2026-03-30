// lib/ai-composer.js
// Handles generic API calls to Groq, Gemini, and OpenRouter for text generation

export class AiComposer {
    static async generatePost(provider, apiKey, contextData, tone, niche) {
        if (!apiKey) {
            throw new Error(`กรุณาตั้งค่า API Key สำหรับ ${provider} ในหน้า Settings ก่อนครับ`);
        }

        // Prepare context
        const contextString = contextData.map(item => 
            `- หัวข้อ: ${item.newsTitle}\n  เนื้อหาข่าวย่อๆ: ${item.newsSnippet}`
        ).join('\n\n');

        const systemPrompt = `คุณคือผู้เชี่ยวชาญด้านโซเชีลมีเดียที่เก่งในการเขียนโพสต์ Facebook ให้น่าสนใจ 
กรุณาเขียนโพสต์ตามข้อมูลข่าวต่อไปนี้:
${contextString}

คำสั่งและข้อควรระวัง:
1. น้ำเสียง (Tone): ${tone}
2. กลุ่มเป้าหมาย/เพจแนว (Niche): ${niche || 'เพจทั่วไป'}
3. ให้สรุปเนื้อหาให้กระชับ เล่าเรื่องน่าสนใจ ชวนคุย
4. ใส่ Emoji ให้เหมาะสม
5. ตอนท้ายให้ใส่ Hashtags ที่เกี่ยวกับเรื่องนี้ 3-5 อัน
6. ข้อความต้องเป็นภาษาไทยเท่านั้น และเขียนออกมาเป็นข้อความพร้อมนำไปโพสต์เลย (ห้ามมีคำพูดตอบรับอื่นๆ นำหน้า)`;

        console.log(`[AI Composer] Triggering Generation via: ${provider}`);

        if (provider === 'groq') {
            return this.callGroq(apiKey, systemPrompt);
        } else if (provider === 'gemini') {
            return this.callGemini(apiKey, systemPrompt);
        } else if (provider === 'openrouter') {
            return this.callOpenRouter(apiKey, systemPrompt);
        } else {
            throw new Error('ระบบ AI นี้ยังไม่ได้รับการรองรับ');
        }
    }

    static async callGroq(apiKey, prompt) {
        const url = 'https://api.groq.com/openai/v1/chat/completions';
        const payload = {
            model: "llama-3.3-70b-versatile", // Use latest supported Groq model
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`Groq Code ${response.status}: ${err?.error?.message || response.statusText}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    }

    static async callGemini(apiKey, prompt) {
        // ใช้ Gemini 2.0 Flash
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const payload = {
            contents: [{ parts: [{ text: prompt }] }]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`Gemini Code ${response.status}: ${err?.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    static async callOpenRouter(apiKey, prompt) {
        const url = 'https://openrouter.ai/api/v1/chat/completions';
        const payload = {
            model: "anthropic/claude-3-haiku", // Fast general model on OR (or could let user select)
            messages: [{ role: "user", content: prompt }]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`OpenRouter Code ${response.status}: ${err?.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }
}
