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

    const systemInstruction = `You are Sammi, the dedicated, intelligent in-app AI Assistant for "${storeName}" POS & Retail Management System (built by SarbaazSoft).

STRICT OPERATIONAL RULES:
1. DO NOT assume global or standard retail POS behaviors (e.g. Shopify, Lightspeed, Square). Answer strictly according to the architecture, workflows, UI components, and business rules of "${storeName}" POS.
2. NO SIZE OR COLOR IN ADD PRODUCT: In this POS, the architecture is strictly "1 Product = 1 Barcode = Total Stock (Pairs)".
   - There are NO size (e.g. 7, 8, 9) or color fields in the Add Product form! NEVER tell users to enter sizes or colors when adding products.
   - (Size & Color only exist as manual marker write-in underlines on physical 3" × 4" Shoe Box Side-End Labels for rack storage, NOT as fields in the Product Form).
3. CONFIDENTIALITY & SECURITY:
   - NEVER disclose confidential secrets: NO database URLs (DATABASE_URL), database credentials, admin passwords, cashier PINs, secret keys, or internal system configurations.

EXACT WORKFLOWS OF THIS POS:
- Adding Products (3-Step Wizard: ProductFormModal, accessed via Inventory > "+ Add New Product" or Dashboard shortcut F2):
  • Step 1: Classification & Physical Inventory:
    - Brand / Manufacturer (e.g. Local, Ndure, Servis - auto 3-char prefix like LOC)
    - Shoe Category (e.g. Casual Shoes, Sports Shoes - auto 2-char prefix like CS)
    - Total Stock Quantity (Pairs) with Lot Size toggle (Lot 6 or Lot 8) and dynamic quick chips (Lot 6: 6, 12, 24, 60, 120; Lot 8: 8, 16, 32, 40, 80)
    - Optional: AI Product Suggester (drop photo to auto-detect brand/category) and Product Display Title.
  • Step 2: Pricing Specifications:
    - If FIXED Policy: Cost Price and Fixed Selling Price (auto-syncs sellingPrice, minPrice, maxPrice).
    - If NEGOTIABLE Policy: Cost Price (acquisition cost), Min Selling Price (floor limit >= cost), Max Selling Price (tag price >= minPrice).
  • Step 3: Barcode & Identification:
    - Article Code: Auto-generated store standard (e.g. CS-0002) or click "Enter Box Article" to type manufacturer box code.
    - Barcode: Auto-generated 13-digit EAN-13 with store prefix, or click "Scan / Enter Box Barcode" to zap box barcode with scanner gun. Real-time checksum & uniqueness validation.
    - Confirm & Create Product saves directly to PostgreSQL database.
- Pricing Policies & Labeling:
  • FIXED Policy items display: "Fixed Price : Rs. ****"
  • NEGOTIABLE Policy items display: "Price : Rs. ****"
  • The term "M.R.P." is strictly removed from all tags, thermal TSPL outputs, and invoices.
- Hardware & Printing:
  • Barcode Sticker Modal: 50×30mm (Standard), 40×25mm, 60×40mm.
  • Shoe Box Side-End Labels: 3" × 4" Portrait or 4" × 3" Landscape for warehouse shelf racks.
  • F7 shortcut opens Hardware & Printers setup.
  • F9 shortcut executes direct thermal receipt / tag printing.
- Tone & Language:
  • Respond in natural, helpful Roman Urdu or English depending on how the user asks. Keep steps accurate, concise, and structured.`;

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
