import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

let aiClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Please provide a valid Gemini API key in Settings > Secrets.'
    );
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export interface ImagePartData {
  mimeType: string;
  data: string; // Base64 encoded
}

/**
 * Resolves an image source (data URL, HTTP URL, or local relative path)
 * into a base64 inline data part for Gemini API.
 */
export async function resolveImageToPart(imageSource: string): Promise<ImagePartData> {
  const trimmed = imageSource.trim();

  // Case 1: Data URL (e.g., data:image/png;base64,....)
  if (trimmed.startsWith('data:')) {
    const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new Error('Invalid base64 data URL format.');
    }
    return {
      mimeType: match[1],
      data: match[2],
    };
  }

  // Case 2: HTTP or HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(trimmed, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 ShoePOS/2.0',
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to download image: HTTP ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      return {
        mimeType: contentType.split(';')[0].trim(),
        data: buffer.toString('base64'),
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw new Error(`Could not fetch image from URL: ${err.message || err}`);
    }
  }

  // Case 3: Local relative asset path (e.g., /assets/images/hd-07.jpg or src/assets/...)
  const cleanPath = trimmed.replace(/^\/+/, '');
  const candidatePaths = [
    path.join(process.cwd(), cleanPath),
    path.join(process.cwd(), 'public', cleanPath),
    path.join(process.cwd(), 'src', cleanPath),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      const ext = path.extname(candidate).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
      };
      const mimeType = mimeMap[ext] || 'image/jpeg';
      const fileBuf = await fs.promises.readFile(candidate);
      return {
        mimeType,
        data: fileBuf.toString('base64'),
      };
    }
  }

  // Fallback: If it's a raw base64 string without data: prefix
  if (trimmed.length > 100 && /^[A-Za-z0-9+/=]+$/.test(trimmed.slice(0, 100))) {
    return {
      mimeType: 'image/jpeg',
      data: trimmed,
    };
  }

  throw new Error('Image source could not be resolved. Please upload an image or provide a valid image URL.');
}

export const ALLOWED_CATEGORIES = [
  'Misc',
  'Formal Dress Shoes',
  'Casual Shoes',
  'Sandals & Chappals',
  'Closed Flats',
  'Flat Sandals',
  'Heeled Sandals',
  'Closed Heels & Pumps',
  'Boys Footwear',
  'Girls Footwear',
] as const;
export type AllowedCategory = (typeof ALLOWED_CATEGORIES)[number];

export const STRICT_FOOTWEAR_INVALID_ALERT =
  'Alert: Image is not a valid footwear image. Please upload an image of a shoe.';

export interface BrandSuggestionMatch {
  suggestedName: string;
  matchedId?: number | null;
  matchedName?: string | null;
  isExisting?: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  isUnknown: boolean;
}

export interface CategorySuggestionMatch {
  suggestedName: AllowedCategory;
  matchedId?: number | null;
  matchedName?: string | null;
  isExisting?: boolean;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AiProductAnalysisResult {
  brand: BrandSuggestionMatch;
  category: CategorySuggestionMatch;
  title: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  visualClues: string[];
  observations: string;
  rawOutput: string;
  formattedOutput: string;
  isValidFootwear: boolean;
}

/**
 * Enforces strictly ONE single category from the 9 store footwear options:
 * Formal Dress Shoes, Casual Shoes, Sandals & Chappals, Closed Flats,
 * Flat Sandals, Heeled Sandals, Closed Heels & Pumps, Boys Footwear, Girls Footwear.
 * Rejects combined categories and cleanly resolves sandal distinctions (Men vs Women Flat vs Women Heeled).
 */
export function enforceSingleCategory(rawCategory: string): AllowedCategory {
  const clean = (rawCategory || '').trim();
  const lower = clean.toLowerCase();

  // 1. Exact case-insensitive check
  const exact = ALLOWED_CATEGORIES.find((cat) => cat.toLowerCase() === lower);
  if (exact) return exact;

  if (lower.includes('misc') || lower.includes('miscellaneous') || lower.includes('general')) {
    return 'Misc';
  }

  // 2. Children / Kids footwear
  if (lower.includes('boy') || lower.includes('boys')) return 'Boys Footwear';
  if (lower.includes('girl') || lower.includes('girls')) return 'Girls Footwear';
  if (lower.includes('kid') || lower.includes('child') || lower.includes('toddler')) {
    return 'Boys Footwear';
  }

  // 3. Sandal distinctions:
  // - Women's Heeled Sandals (elevated heels, block heels, wedges, stilettos)
  if (
    lower.includes('heeled sandal') ||
    (lower.includes('sandal') && (lower.includes('heel') || lower.includes('wedge') || lower.includes('high') || lower.includes('platform')))
  ) {
    return 'Heeled Sandals';
  }

  // - Women's Flat Sandals (flat open-toe, delicate straps, gladiator flats, slides)
  if (
    lower.includes('flat sandal') ||
    (lower.includes('sandal') && (lower.includes('women') || lower.includes('lady') || lower.includes('female') || lower.includes('flat') || lower.includes('strappy') || lower.includes('gladiator')))
  ) {
    return 'Flat Sandals';
  }

  // - Men's Sandals & Chappals (broad straps, Peshawari chappals, masculine slides, utility straps)
  if (
    lower.includes('chappal') ||
    lower.includes('peshawari') ||
    (lower.includes('sandal') && (lower.includes('men') || lower.includes('male') || lower.includes('gents') || lower.includes('man')))
  ) {
    return 'Sandals & Chappals';
  }

  // 4. Closed Heels & Pumps (women's elevated closed-toe heels, court shoes, stilettos, pumps)
  if (
    lower.includes('pump') ||
    lower.includes('court shoe') ||
    lower.includes('closed heel') ||
    lower.includes('stiletto') ||
    (lower.includes('heel') && !lower.includes('sandal'))
  ) {
    return 'Closed Heels & Pumps';
  }

  // 5. Closed Flats (women's flat closed shoes, ballerinas, ballet flats, closed loafers, moccasins)
  if (
    lower.includes('closed flat') ||
    lower.includes('ballerina') ||
    lower.includes('ballet') ||
    (lower.includes('flat') && !lower.includes('sandal'))
  ) {
    return 'Closed Flats';
  }

  // 6. Formal Dress Shoes (men's formal leather shoes, oxfords, derbies, brogues, monk straps, formal dress slip-ons)
  if (
    lower.includes('formal') ||
    lower.includes('oxford') ||
    lower.includes('derby') ||
    lower.includes('brogue') ||
    lower.includes('dress shoe') ||
    lower.includes('monk') ||
    (lower.includes('loafer') && (lower.includes('men') || lower.includes('formal') || lower.includes('leather')))
  ) {
    return 'Formal Dress Shoes';
  }

  // 7. General sandal/slide/slipper fallback
  if (lower.includes('sandal') || lower.includes('slide') || lower.includes('slipper') || lower.includes('flip')) {
    return 'Sandals & Chappals';
  }

  // 8. Casual / Sneakers / Boots default
  return 'Casual Shoes';
}

/**
 * Sanitizes the product title according to strict footwear rules:
 * - DO NOT include current shoe color (removes "Black", "Red/White", "Navy", etc.)
 * - DO NOT include generic descriptors ("current shoe", "uploaded image", "this shoe")
 * - Focus solely on brand, model name, style line, or silhouette (e.g. "Air Force 1 '07", "Classic Leather")
 */
export function sanitizeShoeTitle(rawTitle: string): string {
  let title = (rawTitle || '').trim();

  // Strip generic descriptors
  title = title.replace(/\b(current shoe|uploaded image|this shoe|the shoe|a pair of|pair of|footwear|sample shoe|shoe image|product image)\b/gi, '');

  // Strip color terms and combined slashes
  const colorPattern = /\b(black|white|red|blue|green|yellow|orange|purple|pink|brown|grey|gray|navy|beige|tan|cream|gold|silver|bronze|maroon|burgundy|olive|teal|turquoise|cyan|magenta|violet|charcoal|multi-color|multicolor|monochrome|triple black|triple white)\b/gi;

  // Remove compound color slashes like "Red/White" or "Black/Gum"
  title = title.replace(/\b[a-zA-Z]+\/[a-zA-Z]+\b/g, (match) => {
    const parts = match.split('/');
    if (parts.some((p) => colorPattern.test(p))) {
      return '';
    }
    return match;
  });

  title = title.replace(colorPattern, '');

  // Clean redundant punctuation, dangling hyphens, and multi-spaces
  title = title
    .replace(/["'“”]/g, '')
    .replace(/[,\-_/\\|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return title;
}

/**
 * Intelligent comparison of AI-suggested Brand against existing store brands.
 */
export function matchBrand(
  suggestedBrand: string,
  existingBrands: (string | { id?: number; name: string })[] = []
): BrandSuggestionMatch {
  const cleanSuggested = (suggestedBrand || '').trim();
  const lowerSuggested = cleanSuggested.toLowerCase();

  const brandNames = existingBrands.map((b) => (typeof b === 'string' ? b : b.name));

  // Check if brand is explicitly unknown
  const isUnknown =
    !cleanSuggested ||
    lowerSuggested.includes('unknown') ||
    lowerSuggested.includes('not clearly visible') ||
    lowerSuggested.includes('unbranded') ||
    lowerSuggested.includes('n/a') ||
    lowerSuggested === 'none';

  if (isUnknown) {
    const unbrandedMatch = brandNames.find(
      (b) => b.toLowerCase() === 'local' || b.toLowerCase() === 'unbranded' || b.toLowerCase() === 'generic'
    );
    return {
      suggestedName: unbrandedMatch || 'Local',
      matchedName: unbrandedMatch || 'Local',
      isExisting: Boolean(unbrandedMatch),
      confidence: 'LOW',
      isUnknown: true,
    };
  }

  // 1. Exact match (case-insensitive)
  const exact = brandNames.find((b) => b.trim().toLowerCase() === lowerSuggested);
  if (exact) {
    return {
      suggestedName: exact,
      matchedName: exact,
      isExisting: true,
      confidence: 'HIGH',
      isUnknown: false,
    };
  }

  // 2. Normalized word matching (e.g. "Nike Inc" -> "Nike", "Adidas Originals" -> "Adidas")
  const strippedSuggested = lowerSuggested
    .replace(/\b(shoes|footwear|inc|corporation|originals|sportswear|sport|apparel)\b/gi, '')
    .trim();

  for (const b of brandNames) {
    const bLower = b.trim().toLowerCase();
    const strippedB = bLower
      .replace(/\b(shoes|footwear|inc|corporation|originals|sportswear|sport|apparel)\b/gi, '')
      .trim();

    if (
      bLower === strippedSuggested ||
      strippedB === strippedSuggested ||
      lowerSuggested.startsWith(bLower + ' ') ||
      bLower.startsWith(lowerSuggested + ' ')
    ) {
      return {
        suggestedName: b,
        matchedName: b,
        isExisting: true,
        confidence: 'HIGH',
        isUnknown: false,
      };
    }
  }

  // 3. No match found -> Return new brand suggestion that can be typed
  return {
    suggestedName: cleanSuggested,
    matchedName: null,
    isExisting: false,
    confidence: 'MEDIUM',
    isUnknown: false,
  };
}

/**
 * Intelligent comparison of AI-suggested Category against existing store categories.
 * Enforces strictly ONE single category from the 9 retail footwear options.
 */
export function matchCategory(
  suggestedCategory: string,
  existingCategories: (string | { id?: number; name: string })[] = []
): CategorySuggestionMatch {
  const singleCategory = enforceSingleCategory(suggestedCategory);
  const lowerSingle = singleCategory.toLowerCase();
  const categoryNames = existingCategories.map((c) => (typeof c === 'string' ? c : c.name));

  // 1. Exact match (case-insensitive)
  const exact = categoryNames.find((c) => c.trim().toLowerCase() === lowerSingle);
  if (exact) {
    return {
      suggestedName: singleCategory,
      matchedName: exact,
      isExisting: true,
      confidence: 'HIGH',
    };
  }

  // 2. Singular/plural and direct affinity matches
  for (const c of categoryNames) {
    const cLower = c.trim().toLowerCase();
    if (
      cLower === lowerSingle ||
      cLower.includes(lowerSingle) ||
      lowerSingle.includes(cLower) ||
      (singleCategory === 'Misc' && (cLower === 'misc' || cLower.includes('misc') || cLower.includes('miscellaneous'))) ||
      (singleCategory === 'Formal Dress Shoes' && (cLower === 'formal' || cLower.includes('formal') || cLower.includes('dress'))) ||
      (singleCategory === 'Casual Shoes' && (cLower === 'casual' || cLower === 'sports' || cLower.includes('sneaker') || cLower.includes('running'))) ||
      (singleCategory === 'Sandals & Chappals' && (cLower === 'sandals' || cLower === 'sandal' || cLower === 'slippers' || cLower.includes('chappal') || cLower.includes('men sandal'))) ||
      (singleCategory === 'Flat Sandals' && (cLower.includes('flat sandal') || (cLower.includes('sandal') && (cLower.includes('women') || cLower.includes('flat'))))) ||
      (singleCategory === 'Heeled Sandals' && (cLower.includes('heeled sandal') || (cLower.includes('heel') && cLower.includes('sandal')))) ||
      (singleCategory === 'Closed Flats' && (cLower === 'flats' || cLower === 'flat' || cLower.includes('ballerina'))) ||
      (singleCategory === 'Closed Heels & Pumps' && (cLower === 'pumps' || cLower === 'pump' || cLower.includes('heels') || cLower.includes('court'))) ||
      (singleCategory === 'Boys Footwear' && (cLower.includes('boy') || cLower === 'kids')) ||
      (singleCategory === 'Girls Footwear' && (cLower.includes('girl') || cLower === 'kids'))
    ) {
      return {
        suggestedName: singleCategory,
        matchedName: c,
        isExisting: true,
        confidence: 'HIGH',
      };
    }
  }

  // 3. Return single category suggestion
  return {
    suggestedName: singleCategory,
    matchedName: null,
    isExisting: false,
    confidence: 'MEDIUM',
  };
}

/**
 * Executes Gemini multimodal analysis on a product image.
 * Specialized exclusively in footwear analysis with strict validation,
 * single category selection, title color removal, and exact mandated output structure.
 */
export async function analyzeProductImageWithGemini(
  imageSource: string,
  existingBrands: (string | { id?: number; name: string })[] = [],
  existingCategories: (string | { id?: number; name: string })[] = []
): Promise<AiProductAnalysisResult> {
  const ai = getGeminiClient();
  const imagePart = await resolveImageToPart(imageSource);

  const prompt = `You are an AI assistant specialized exclusively in retail footwear inventory analysis. Your task is to analyze user-uploaded shoe images and output a Brand Name, Category, and Title.

Operational & POS Search Context:
In this shoe retail POS and inventory management system, retail sales staff search items primarily using Barcode scanning or Article numbers (e.g. SF-0012). SKU codes follow an automated format (\${brandCode}-\${articleNumber}-\${size}, e.g. DAF-SF-0012-42) and are handled automatically in the background without requiring manual input or SKU searches from staff.

Core Rules & Guardrails
Strict Shoe Validation:

Before analyzing, verify if the uploaded image contains footwear of any kind (e.g., sneakers, boots, sandals, heels, dress shoes, slippers, chappals).

If the image does NOT contain shoes: Immediately stop analysis and return ONLY the following exact message:

Alert: Image is not a valid footwear image. Please upload an image of a shoe.

Category Selection:

Select strictly ONE single category from the following 9 options:
1. Formal Dress Shoes (Men's formal leather shoes, oxfords, derbies, brogues, monk straps, formal dress slip-ons)
2. Casual Shoes (Sneakers, athletic/running shoes, trainers, tennis shoes, joggers, casual canvas, casual boots)
3. Sandals & Chappals (Men's open footwear, broad-strap sandals, Peshawari chappals, traditional chappals, men's slides, thong chappals)
4. Closed Flats (Women's flat closed-toe shoes: ballerinas, ballet flats, closed loafers, moccasins, closed mules)
5. Flat Sandals (Women's flat open-toe sandals, flat strappy sandals, gladiator flats, delicate open slides)
6. Heeled Sandals (Women's open-toe sandals with elevated heel: block heels, wedge sandals, kitten heels, stiletto sandals)
7. Closed Heels & Pumps (Women's closed-toe high heels: court shoes, stilettos, closed pointed heels, block pumps)
8. Boys Footwear (Children's footwear for young boys: boys sneakers, boys sandals, cartoon/velcro shoes)
9. Girls Footwear (Children's footwear for young girls: girls ballerinas, pink/glitter party shoes, girls sandals)

CRITICAL SANDAL CLASSIFICATION DIRECTIVE:
When analyzing ANY sandal, slide, or open-footwear image, you MUST distinguish between men's and women's:
- If it is designed for MEN (broad leather straps, utility soles, Peshawari/Kheri style, masculine slide, traditional chappal) -> Classify strictly as "Sandals & Chappals".
- If it is designed for WOMEN with a FLAT sole (no elevated heel, thin/delicate straps, open toe, feminine slide) -> Classify strictly as "Flat Sandals".
- If it is designed for WOMEN with an ELEVATED HEEL (block heel, wedge, stiletto heel) -> Classify strictly as "Heeled Sandals".
- If it is for children -> Classify as "Boys Footwear" or "Girls Footwear".
DO NOT output generic "Sandals" or "Slippers". You MUST select one of the exact 9 categories above.

Title Rules:

DO NOT include the current shoe color in the title (e.g., remove terms like "Black", "Brown", "Red/White", "Navy", "Tan").

DO NOT include generic descriptors like "current shoe", "uploaded image", "footwear".

Focus solely on the brand, model name, style line, or silhouette (e.g., "Air Max 270", "Double Monk Strap Oxford", "Strappy Block Heel Sandal", "Peshawari Chappal Norozi", "Classic Leather Runner").

Output Format
If the image is validated as footwear, output the results using the exact structure below:

Brand Name: [Brand Name or Unknown / Not clearly visible]

Category: [Exact Category from the 9 options]

Suggested Title: [Model/Style Name without color words]`;

  const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];
  let rawText = '';
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            inlineData: {
              mimeType: imagePart.mimeType,
              data: imagePart.data,
            },
          },
          {
            text: prompt,
          },
        ],
        config: {
          temperature: 0.1,
        },
      });

      rawText = response.text || '';
      if (rawText) {
        break;
      }
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || err || '');
      const isRateLimit = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota');
      const isHighDemand = msg.includes('503') || msg.includes('high demand') || msg.includes('UNAVAILABLE');

      if (isHighDemand) {
        console.log(`[Product Image AI] Model ${model} high demand (503), switching to fallback model...`);
      } else if (isRateLimit) {
        console.log(`[Product Image AI] Model ${model} rate-limited (429), switching to fallback model...`);
      } else {
        console.log(`[Product Image AI] Model ${model} unavailable, trying fallback model...`);
      }
      // Wait briefly before attempting next model fallback
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  if (!rawText) {
    let friendlyError = lastError?.message || 'AI service is temporarily unavailable. Please verify your connection or try again.';
    if (friendlyError.includes('429') || friendlyError.includes('RESOURCE_EXHAUSTED')) {
      const retryMatch = friendlyError.match(/retry in\s+([0-9.]+[smh]?)/i);
      if (retryMatch) {
        friendlyError = `Gemini AI quota exceeded. Please retry in ${Math.ceil(parseFloat(retryMatch[1]))}s.`;
      } else {
        friendlyError = 'Gemini AI rate limit or quota exceeded. Please wait a moment and try again.';
      }
    } else if (friendlyError.includes('503') || friendlyError.includes('UNAVAILABLE')) {
      friendlyError = 'The AI service is experiencing high demand. Please try again shortly.';
    }
    throw new Error(friendlyError);
  }

  const trimmedText = rawText.trim();

  // 1. Strict Shoe Validation:
  // If image does NOT contain shoes, trigger the exact mandated alert
  if (
    trimmedText.includes('Alert: Image is not a valid footwear image') ||
    trimmedText.toLowerCase().includes('not a valid footwear image') ||
    trimmedText.toLowerCase().includes('please upload an image of a shoe')
  ) {
    throw new Error(STRICT_FOOTWEAR_INVALID_ALERT);
  }

  // 2. Parse Brand Name, Category, and Suggested Title
  let extractedBrand = '';
  let extractedCategory = '';
  let extractedTitle = '';

  const brandMatch = trimmedText.match(/Brand(?:\s+Name)?\s*:\s*([^\n\r]+)/i);
  const categoryMatch = trimmedText.match(/Category\s*:\s*([^\n\r]+)/i);
  const titleMatch = trimmedText.match(/(?:Suggested\s+)?Title\s*:\s*([^\n\r]+)/i);

  if (brandMatch) extractedBrand = brandMatch[1].trim();
  if (categoryMatch) extractedCategory = categoryMatch[1].trim();
  if (titleMatch) extractedTitle = titleMatch[1].trim();

  // JSON fallback if model returned JSON
  if (!extractedBrand || !extractedCategory || !extractedTitle) {
    try {
      const cleanedJson = trimmedText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedJson);
      if (parsed) {
        if (!extractedBrand) extractedBrand = String(parsed['Brand Name'] || parsed.brand || parsed.brandName || '').trim();
        if (!extractedCategory) extractedCategory = String(parsed.Category || parsed.category || '').trim();
        if (!extractedTitle) extractedTitle = String(parsed['Suggested Title'] || parsed.suggestedTitle || parsed.title || '').trim();
      }
    } catch (_) {}
  }

  // Line-by-line fallback
  if (!extractedBrand || !extractedCategory || !extractedTitle) {
    const lines = trimmedText.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (!extractedBrand && /^brand/i.test(line)) {
        extractedBrand = line.replace(/^brand(?:\s*name)?[:\s-]*/i, '').trim();
      } else if (!extractedCategory && /^category/i.test(line)) {
        extractedCategory = line.replace(/^category[:\s-]*/i, '').trim();
      } else if (!extractedTitle && /(?:suggested\s*)?title/i.test(line)) {
        extractedTitle = line.replace(/^(?:suggested\s*)?title[:\s-]*/i, '').trim();
      }
    }
  }

  // Clean brand name
  if (
    !extractedBrand ||
    extractedBrand.toLowerCase().includes('unknown') ||
    extractedBrand.toLowerCase().includes('not clearly') ||
    extractedBrand.toLowerCase() === 'none' ||
    extractedBrand.toLowerCase() === 'n/a'
  ) {
    extractedBrand = 'Unknown / Not clearly visible';
  }

  // 3. Category Selection: strictly ONE single category from the 9 retail footwear categories
  const finalCategory = enforceSingleCategory(extractedCategory);

  // 4. Title Rules: remove color words, remove generic descriptors, focus solely on model/style name
  let finalTitle = sanitizeShoeTitle(extractedTitle);
  if (!finalTitle) {
    finalTitle = extractedBrand !== 'Unknown / Not clearly visible'
      ? `${extractedBrand} ${finalCategory}`
      : `${finalCategory}`;
  }

  // 5. Output Format exact structure
  const formattedOutput = `Brand Name: ${extractedBrand}\n\nCategory: ${finalCategory}\n\nSuggested Title: ${finalTitle}`;

  const brandMatchObj = matchBrand(extractedBrand, existingBrands);
  const categoryMatchObj = matchCategory(finalCategory, existingCategories);

  return {
    brand: brandMatchObj,
    category: categoryMatchObj,
    title: finalTitle,
    confidence: 'HIGH',
    visualClues: [
      `Footwear silhouette: ${finalCategory}`,
      `Brand identification: ${extractedBrand}`,
      `Silhouette / Model: ${finalTitle}`,
    ],
    observations: `Verified footwear image. Category classified strictly as ${finalCategory}. Product title focused on model/style silhouette without color words.`,
    rawOutput: trimmedText,
    formattedOutput,
    isValidFootwear: true,
  };
}
