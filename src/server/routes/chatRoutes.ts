import { Router } from 'express';
import type { Request, Response } from 'express';
import { getGeminiClient } from '../gemini.ts';
import { pgClient } from '../../db/index.ts';

const router = Router();

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { messages = [], model: requestedModel, storeName: customStoreName } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required.' });
    }

    // Resolve store name from database if not supplied
    let storeName = customStoreName?.trim() || '';
    if (!storeName) {
      try {
        const settingsRes = await pgClient.query<{ name: string; company_name: string }>(
          'SELECT name, company_name FROM company_settings LIMIT 1'
        );
        storeName = settingsRes.rows[0]?.name || settingsRes.rows[0]?.company_name || 'TJ Shoes';
      } catch {
        storeName = 'TJ Shoes';
      }
    }

    // Model selection based on user mode preference
    let chosenModel = 'gemini-3.8-flash';
    if (requestedModel === 'gemini-3.1-flash-lite' || requestedModel === 'fast') {
      chosenModel = 'gemini-3.1-flash-lite';
    } else if (requestedModel === 'gemini-3.1-pro-preview' || requestedModel === 'complex') {
      chosenModel = 'gemini-3.1-pro-preview';
    } else if (requestedModel === 'gemini-flash-latest') {
      chosenModel = 'gemini-flash-latest';
    } else {
      chosenModel = 'gemini-3.8-flash';
    }

    const systemInstruction = `You are Sammi, the intelligent, dedicated AI Assistant for "${storeName}" POS & Retail Management System.

You are a genuine, dynamic conversational AI model powered by Gemini. You DO NOT use fixed, canned, or robotic FAQ templates.
You listen to the user and dynamically answer their specific questions, problems, calculations, or inquiries.

Core Principles:
- Tone & Language: Warm, polite, professional, and intelligent. Respond in simple, natural Roman Urdu or English matching the user's language style.
- Capabilities: Help with counter checkout, sales billing, customer returns & exchange management, inventory cataloging, stock receiving, supplier orders, profit margin calculations, price adjustments, barcode scanning, thermal printing, daily reporting, and store operations.
- Format: Keep answers clear, direct, and well-structured using markdown headings and bullet points where helpful.
- Tailored Solutions: Every response must be uniquely tailored to the user's prompt without reciting rigid repetitive FAQ scripts.`;

    // Attempt Gemini call via server-side SDK
    try {
      const ai = getGeminiClient();

      // Format multi-turn contents for Gemini SDK
      const contentsPayload = messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(m.text || '') }],
      }));

      // Candidate models with multiple high-availability fallbacks:
      // If 3.8-flash has a 503 high demand spike, seamlessly try 3.1-flash-lite, 2.5-flash, or 2.5-flash-lite
      const candidatePool = [
        chosenModel,
        'gemini-3.1-flash-lite',
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-flash-latest',
        'gemini-3.8-flash',
      ];

      // Deduplicate preserving order
      const modelCandidates = Array.from(new Set(candidatePool));

      let replyText = '';
      let usedModel = chosenModel;
      let lastQuotaError = false;
      let lastHighDemandError = false;

      for (const model of modelCandidates) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: contentsPayload,
            config: {
              systemInstruction,
              temperature: 0.7,
            },
          });

          if (response.text) {
            replyText = response.text.trim();
            usedModel = model;
            break;
          }
        } catch (callErr: any) {
          const errMsg = String(callErr?.message || callErr || '');
          const isHighDemand = errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('UNAVAILABLE');
          const isRateLimit = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota');

          if (isHighDemand) {
            lastHighDemandError = true;
            console.log(`[Chat] Model ${model} is experiencing temporary high demand (503), switching to alternate model...`);
          } else if (isRateLimit) {
            lastQuotaError = true;
            console.log(`[Chat] Model ${model} quota limit reached (429), switching to alternate model...`);
          } else {
            console.log(`[Chat] Model ${model} temporarily unavailable, trying next candidate...`);
          }

          // Brief delay before querying next fallback
          await new Promise((resolve) => setTimeout(resolve, 200));
          continue;
        }
      }

      if (replyText) {
        return res.json({
          reply: replyText,
          modelUsed: usedModel,
          storeName,
        });
      }

      // If all models hit 503 high demand spikes, inform user politely without 500 crash
      if (lastHighDemandError) {
        return res.json({
          reply: `**Notice:** Gemini AI servers par is waqt temporary high demand hai. Baraye meharbani 15–20 seconds intezar karke dobara message karein.\n\n*Aapka counter billing aur store operations normal tareeqe se kaam kar raha hai.*`,
          modelUsed: 'high-demand-notice',
          storeName,
        });
      }

      // If all models hit 429 quota exhaustion, respond gracefully
      if (lastQuotaError) {
        return res.json({
          reply: `**Notice:** Gemini AI API par temporary quota/rate-limit hit hua hai. Baraye meharbani 30–40 seconds intezar karke dobara message karein.\n\n*Aap counter sales, product catalog, ya returns ke operations normal tareeqe se jari rakh sakte hain.*`,
          modelUsed: 'rate-limit-notice',
          storeName,
        });
      }
    } catch (sdkErr: any) {
      console.log('[Chat] Gemini SDK initialization notice: Check GEMINI_API_KEY');
      return res.status(503).json({
        error: 'Gemini AI service unavailable. Check GEMINI_API_KEY in server secrets.',
      });
    }

    return res.json({
      reply: `Sammi AI is currently busy. Baraye meharbani kuch lamhon baad dobara sawal poochiye.`,
      modelUsed: 'fallback',
      storeName,
    });
  } catch (err: any) {
    console.log('[Chat] Endpoint request processing notice');
    res.status(500).json({
      error: 'Failed to process chat query.',
    });
  }
});

export default router;
