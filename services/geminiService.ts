
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Category, Season, AnalyzedShopItem, ClothingItem, MatchResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const itemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    brand: { type: Type.STRING, description: "Brand name. If screenshot, extract exact brand text visible in the image. If not visible, infer from style or return 'Unknown'." },
    sizeLabel: { type: Type.STRING, description: "Size on tag (e.g., 2T, 6M, 5Y). If screenshot, look for 'Size: X' text." },
    color: { type: Type.STRING, description: "Primary color. Infer from image or text description." },
    category: { 
      type: Type.STRING, 
      enum: [
        Category.Top, 
        Category.Bottom, 
        Category.FullBody, 
        Category.Romper,
        Category.Overall,
        Category.Shoes, 
        Category.Outerwear, 
        Category.Vest,
        Category.Accessory,
        Category.Tights,
        Category.Pajamas,
        Category.Swimwear,
        Category.Socks
      ],
      description: "Category of the item."
    },
    seasons: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: [Season.Spring, Season.Summer, Season.Fall, Season.Winter, Season.All] },
      description: "Suitable seasons."
    },
    description: { type: Type.STRING, description: "Detailed product name. Capture exact text from screenshot if available (e.g. 'Floral Cotton Dress')." },
    box_2d: {
      type: Type.ARRAY,
      items: { type: Type.INTEGER },
      description: "The EXACT bounding box [ymin, xmin, ymax, xmax] (0-1000). Crop TIGHTLY to the garment. Exclude all UI, text, buttons, and whitespace padding."
    }
  },
  required: ["category", "color", "seasons", "description"],
};

const multiItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: itemSchema,
      description: "List of all distinct clothing items found."
    }
  }
};

export interface ImageSearchResult {
  success: boolean;
  data?: {
    imageUrl: string;
    sourceUrl: string;
  };
  error?: string;
  suggestion?: string;
}

export interface AnalyzedItem {
  brand?: string;
  sizeLabel?: string;
  color: string;
  category: Category;
  seasons: Season[];
  description: string;
  box_2d?: [number, number, number, number];
  image?: string;
}

/**
 * Resizes and compresses image to ensure payload fits within API limits (avoids 500/XHR errors).
 * Optimized for both standard photos and long screenshots (Shop App/Order lists).
 */
const prepareImageForAPI = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            
            // Heuristic for "Long Screenshot" (e.g. Shop App Order)
            // If height is significantly larger than width, we prioritize height preservation
            const isTall = h > w * 1.5;
            
            let targetW = w;
            let targetH = h;

            if (isTall) {
                // Cap height at 3072 to stay safe within typical vision model limits/payloads
                // But allow width to scale down proportionally
                const MAX_H = 3072; 
                
                if (h > MAX_H) {
                    targetH = MAX_H;
                    targetW = Math.round(w * (MAX_H / h));
                }
            } else {
                 // Standard square/landscape image
                 const MAX_DIM = 1024; // Safe limit for Gemini Vision default
                 if (w > MAX_DIM || h > MAX_DIM) {
                     const ratio = w / h;
                     if (w > h) {
                         targetW = MAX_DIM;
                         targetH = Math.round(targetW / ratio);
                     } else {
                         targetH = MAX_DIM;
                         targetW = Math.round(targetH * ratio);
                     }
                 }
            }
            
            // If no resizing needed and format is jpeg, return original
            if (targetW === w && targetH === h && base64.startsWith('data:image/jpeg')) {
                resolve(base64);
                return;
            }

            const canvas = document.createElement('canvas');
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Fill white background for transparent PNGs converted to JPEG
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, targetW, targetH);
                ctx.drawImage(img, 0, 0, targetW, targetH);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            } else {
                resolve(base64);
            }
        };
        img.onerror = () => resolve(base64);
        img.src = base64;
    });
};

/**
 * Crops a specific region from a base64 image with precision.
 * @param base64 The full source image
 * @param box [ymin, xmin, ymax, xmax] in 0-1000 scale
 * @param paddingPct Optional percentage of padding to add (e.g., 0.01 for 1%).
 */
const cropImage = (base64: string, box: number[], paddingPct: number = 0.01): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Clamp coordinates to safe 0-1000 range
      let [ymin, xmin, ymax, xmax] = box;
      ymin = Math.max(0, Math.min(1000, ymin));
      xmin = Math.max(0, Math.min(1000, xmin));
      ymax = Math.max(0, Math.min(1000, ymax));
      xmax = Math.max(0, Math.min(1000, xmax));

      const w = img.naturalWidth;
      const h = img.naturalHeight;

      // Convert 1000 scale to pixels
      const y1 = (ymin / 1000) * h;
      const x1 = (xmin / 1000) * w;
      const y2 = (ymax / 1000) * h;
      const x2 = (xmax / 1000) * w;

      const boxW = x2 - x1;
      const boxH = y2 - y1;

      // Validate dimensions to prevent 0-width crops or tiny noise
      if (boxW < 10 || boxH < 10) {
        resolve(base64); 
        return;
      }

      // Calculate padding pixels
      const padX = boxW * paddingPct;
      const padY = boxH * paddingPct;

      // Calculate final coordinates with clamping
      // round to integers for crisp canvas drawing
      const finalX = Math.max(0, Math.floor(x1 - padX));
      const finalY = Math.max(0, Math.floor(y1 - padY));
      
      const finalW = Math.min(w - finalX, Math.ceil(boxW + (padX * 2)));
      const finalH = Math.min(h - finalY, Math.ceil(boxH + (padY * 2)));

      // Final safety check
      if (finalW <= 0 || finalH <= 0) {
         resolve(base64);
         return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = finalW;
      canvas.height = finalH;
      
      const ctx = canvas.getContext('2d', { willReadFrequently: false });
      if (ctx) {
        // High quality scaling settings
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Fill white background (standard for product images)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, finalW, finalH);
        
        ctx.drawImage(
          img, 
          finalX, finalY,   // Source start
          finalW, finalH,   // Source dim
          0, 0,             // Dest start
          finalW, finalH    // Dest dim
        );
        
        resolve(canvas.toDataURL('image/jpeg', 0.95)); 
      } else {
        resolve(base64); 
      }
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
};

export const analyzeClothingImage = async (base64Image: string): Promise<AnalyzedItem[]> => {
  try {
    // Resize image before sending to API to prevent XHR/500 errors due to payload size
    const optimizedImage = await prepareImageForAPI(base64Image);
    const cleanBase64 = optimizedImage.split(',')[1] || optimizedImage;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64
            }
          },
          {
            text: `Analyze this image for a closet inventory app. 
      
      GOAL: Detect clothing items from photos OR order screenshots (e.g. Shop App, Amazon, Email Confirmations).

      Tasks:
      1. Detect distinct clothing items.
         - If this is an ORDER SUMMARY or LIST (e.g. Shop App):
           - Scan the list rows vertically.
           - Extract each item image separately.
           - Ignore "Order Placed" headers, total prices, or shipping icons.
         - If this is a single item photo, detect it normally.
      
      2. DIGITAL SCREENSHOTS (Websites/Carts/Social Media):
         - **box_2d**: Focus on the product image thumbnail. Include a small margin around the garment — never cut off any part of the clothing.
         - **CRITICAL EXCLUSIONS**: You must EXCLUDE all UI elements:
           - Price tags ($19.99)
           - "Add to Cart" / "Buy" buttons
           - "Sale" / "New" badges
           - Heart/Favorite icons
           - Text descriptions below or above the image.
         - **Whitespace**: If the product is inside a white square container, crop to the GARMENT, not the container edges. Remove excess white padding.

      3. REAL PHOTOS (Flat Lay/Hanger):
         - **box_2d**: Include the ENTIRE garment with a small margin. Do NOT cut off sleeves, hems, collars, or any part of the clothing. It is better to include too much than too little.
         - **Hangers**: Exclude the hook but keep the full garment below it.
         - **Mannequins**: Exclude the mannequin neck/stand if possible.
         - **Shadows**: Do NOT include cast shadows on the wall/floor.
      
      4. Return a list of items found.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: multiItemSchema,
        thinkingConfig: { thinkingBudget: 2048 }, 
        systemInstruction: `You are an expert fashion image analyzer.
        
        Your bounding boxes must be pixel-perfect.
        - For Screenshots: IGNORE white padding. IGNORE text labels. Crop only the clothes.
        - For Real Photos: IGNORE hangers and background.
        
        Return pure JSON.`,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const parsed = JSON.parse(text);
    const items = parsed.items || [];

    // Process items to crop images if bounding boxes exist
    const processedItems = await Promise.all(items.map(async (item: any) => {
      if (item.box_2d && Array.isArray(item.box_2d) && item.box_2d.length === 4) {
         const [ymin, xmin, ymax, xmax] = item.box_2d;
         const height = ymax - ymin;
         const width = xmax - xmin;
         
         // Filter 1: Invalid coordinates
         if (height <= 0 || width <= 0) return item;

         // Filter 2: Too small — likely noise or misdetection
         if (height < 50 || width < 50) return item;

         // Filter 3: Extreme Aspect Ratios (Noise reduction)
         const ratio = width / height;
         // Reject very thin strips (likely text rows) or very tall thin lines
         if (ratio > 5 || ratio < 0.2) return item;

         // Filter 4: Coordinates out of expected range
         if (ymin < 0 || xmin < 0 || ymax > 1000 || xmax > 1000) return item; 
         
        try {
          // Note: We intentionally use the original 'base64Image' here for the final crop
          // to ensure we get the highest resolution result possible, even though we analyzed a compressed version.
          // Since bounding boxes are normalized (0-1000), they apply correctly to the original image too.
          const croppedImage = await cropImage(base64Image, item.box_2d, 0.08);
          return { ...item, image: croppedImage };
        } catch (e) {
          console.error("Cropping failed", e);
          return item;
        }
      }
      return item;
    }));

    return processedItems;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

/**
 * Searches for a product online and extracts the HD image automatically.
 * Step 1: Gemini + Google Search → finds the product page URL
 * Step 2: Local server proxy → fetches the page, extracts og:image, returns base64
 */
export const findBetterItemImage = async (query: string, base64Image?: string): Promise<ImageSearchResult> => {
  if (!query.trim()) {
    return {
      success: false,
      error: "Missing search terms.",
      suggestion: "Please enter keywords like 'Brand + Color + Type'."
    };
  }

  try {
    // --- Step 1: Gemini finds the product page URL ---
    const parts: any[] = [];

    if (base64Image) {
      const optimized = await prepareImageForAPI(base64Image);
      const cleanBase64 = optimized.split(',')[1] || optimized;
      parts.push({
        inlineData: { mimeType: "image/jpeg", data: cleanBase64 }
      });
    }

    parts.push({
      text: `Find the product page URL for this clothing item: "${query}".

Search for it on Google. Return the product page URL from a retailer or brand website.

Return JSON: { "sourceUrl": "https://..." }
Only return the product page URL, nothing else.`
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    let sourceUrl = '';
    const text = response.text || '';

    if (text) {
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[0]);
          if (data.sourceUrl && data.sourceUrl.startsWith('http')) {
            sourceUrl = data.sourceUrl;
          }
        } catch { /* ignore */ }
      }
      if (!sourceUrl) {
        const urlMatch = cleaned.match(/https?:\/\/[^\s"'<>]+/);
        if (urlMatch) sourceUrl = urlMatch[0];
      }
    }

    // Fallback: grounding chunks
    if (!sourceUrl) {
      const chunks = (response as any).candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks?.length > 0) {
        const web = chunks.find((c: any) => c.web?.uri)?.web;
        if (web?.uri) sourceUrl = web.uri;
      }
    }

    if (!sourceUrl) {
      return {
        success: false,
        error: "Could not find this product online.",
        suggestion: "Try being more specific with brand + product name."
      };
    }

    // --- Step 2: Scrape product page via local server proxy ---
    const scrapeRes = await fetch(`http://localhost:3001/api/scrape-image?url=${encodeURIComponent(sourceUrl)}`);
    const scrapeData = await scrapeRes.json();

    if (scrapeData.imageUrl && scrapeData.imageUrl.startsWith('data:')) {
      // Got base64 image directly — perfect
      return {
        success: true,
        data: { imageUrl: scrapeData.imageUrl, sourceUrl }
      };
    } else if (scrapeData.imageUrl) {
      // Got a URL but not base64 — still usable
      return {
        success: true,
        data: { imageUrl: scrapeData.imageUrl, sourceUrl }
      };
    }

    // Scraping failed, return source URL as fallback
    return {
      success: true,
      data: { imageUrl: '', sourceUrl }
    };

  } catch (error: any) {
    console.error("Online Search Error:", error);
    return {
      success: false,
      error: "Search failed. " + (error.message || ''),
      suggestion: "Please try again."
    };
  }
};

const shopItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            enum: [
              Category.Top,
              Category.Bottom,
              Category.FullBody,
              Category.Romper,
              Category.Overall,
              Category.Shoes,
              Category.Outerwear,
              Category.Vest,
              Category.Accessory,
              Category.Tights,
              Category.Pajamas,
              Category.Swimwear,
              Category.Socks
            ],
            description: "Category of the clothing item."
          },
          color: { type: Type.STRING, description: "Primary color of the item." },
          seasons: {
            type: Type.ARRAY,
            items: { type: Type.STRING, enum: [Season.Spring, Season.Summer, Season.Fall, Season.Winter, Season.All] },
            description: "Applicable seasons for this item."
          },
          description: { type: Type.STRING, description: "Brief description of the item (e.g. 'Striped cotton t-shirt')." }
        },
        required: ["category", "color", "seasons", "description"]
      },
      description: "List of all individual clothing items detected in the flat-lay outfit."
    }
  }
};

/**
 * Analyzes a flat-lay outfit photo from a kids clothing shop post.
 * Detects all individual clothing items in the composition and returns structured data.
 */
export const analyzeShopPost = async (imageBase64: string): Promise<AnalyzedShopItem[]> => {
  try {
    const optimizedImage = await prepareImageForAPI(imageBase64);
    const cleanBase64 = optimizedImage.split(',')[1] || optimizedImage;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64
            }
          },
          {
            text: `This is a flat-lay outfit photo from a kids clothing shop. Detect ALL individual clothing items visible in this outfit composition. For each item, provide: category (one of: Top, Bottom, Full Body, Romper, Overall, Shoes, Outerwear, Vest, Accessory, Tights, Pajamas, Swimwear, Socks), primary color, applicable seasons (Spring, Summer, Fall, Winter, All Year), and a brief description.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: shopItemSchema,
        thinkingConfig: { thinkingBudget: 2048 },
        systemInstruction: `You are an expert at analyzing kids clothing flat-lay photos. Identify every distinct garment and accessory in the image. Be precise with colors and categories. Return pure JSON.`,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const parsed = JSON.parse(text);
    return parsed.items || [];
  } catch (error) {
    console.error("Shop Post Analysis Error:", error);
    throw error;
  }
};

/**
 * Matches analyzed shop items against the user's closet using attribute-based scoring.
 * No Gemini call — purely local comparison.
 *
 * Scoring:
 *  - Same category: +50
 *  - Overlapping season: +20
 *  - Similar color: +30
 */
export const matchItemsToCloset = (shopItems: AnalyzedShopItem[], closetItems: ClothingItem[]): MatchResult[] => {
  const normalizeColor = (c: string): string => c.toLowerCase().trim();

  const colorsMatch = (shopColor: string, closetColor: string): boolean => {
    const a = normalizeColor(shopColor);
    const b = normalizeColor(closetColor);
    if (a === b) return true;
    // Loose matching: one contains the other (e.g. "blue" matches "light blue" or "navy blue")
    if (a.includes(b) || b.includes(a)) return true;
    // Handle common color aliases
    const aliases: Record<string, string[]> = {
      'navy': ['blue', 'dark blue', 'navy blue'],
      'cream': ['white', 'off-white', 'ivory', 'beige'],
      'grey': ['gray'],
      'gray': ['grey'],
      'maroon': ['dark red', 'burgundy'],
      'burgundy': ['dark red', 'maroon'],
      'pink': ['rose', 'blush'],
      'tan': ['beige', 'khaki', 'camel'],
      'beige': ['tan', 'khaki', 'cream'],
    };
    for (const [key, vals] of Object.entries(aliases)) {
      if ((a === key || a.includes(key)) && (vals.some(v => b === v || b.includes(v)))) return true;
      if ((b === key || b.includes(key)) && (vals.some(v => a === v || a.includes(v)))) return true;
    }
    return false;
  };

  const seasonsOverlap = (a: Season[], b: Season[]): boolean => {
    if (a.includes(Season.All) || b.includes(Season.All)) return true;
    return a.some(s => b.includes(s));
  };

  return shopItems.map(shopItem => {
    const candidates: { id: number; score: number; reasons: string[] }[] = [];

    for (const closetItem of closetItems) {
      if (!closetItem.id) continue;

      let score = 0;
      const reasons: string[] = [];

      // Category match
      if (closetItem.category === shopItem.category) {
        score += 50;
        reasons.push(`same category (${shopItem.category})`);
      } else {
        continue; // Only consider items with the same category
      }

      // Season overlap
      if (seasonsOverlap(shopItem.seasons, closetItem.seasons)) {
        score += 20;
        reasons.push('overlapping season');
      }

      // Color match
      if (colorsMatch(shopItem.color, closetItem.color)) {
        score += 30;
        reasons.push(`similar color (${closetItem.color})`);
      }

      candidates.push({ id: closetItem.id, score, reasons });
    }

    // Sort by score descending, take top matches
    candidates.sort((a, b) => b.score - a.score);
    const topMatches = candidates.filter(c => c.score > 0);

    return {
      shopItemDescription: shopItem.description,
      shopItemCategory: shopItem.category,
      matchedClosetItemIds: topMatches.map(m => m.id),
      matchScore: topMatches.length > 0 ? topMatches[0].score : 0,
      matchReason: topMatches.length > 0
        ? topMatches[0].reasons.join(', ')
        : 'No matching items in closet',
    };
  });
};
