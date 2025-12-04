import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Category, Season } from "../types";

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
        Category.Shoes, 
        Category.Outerwear, 
        Category.Accessory,
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
         - **box_2d**: Focus strictly on the product image thumbnail.
         - **CRITICAL EXCLUSIONS**: You must EXCLUDE all UI elements:
           - Price tags ($19.99)
           - "Add to Cart" / "Buy" buttons
           - "Sale" / "New" badges
           - Heart/Favorite icons
           - Text descriptions below or above the image.
         - **Whitespace**: If the product is inside a white square container, crop to the GARMENT, not the container edges. Remove excess white padding.

      3. REAL PHOTOS (Flat Lay/Hanger):
         - **box_2d**: Crop TIGHTLY to the fabric edges.
         - **Hangers**: Exclude the hook entirely. Crop at the shoulder line/neckline.
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

         // Filter 2: Extreme Aspect Ratios (Noise reduction)
         const ratio = width / height;
         // Reject very thin strips (likely text rows) or very tall thin lines
         if (ratio > 5 || ratio < 0.2) return item; 
         
        try {
          // Note: We intentionally use the original 'base64Image' here for the final crop
          // to ensure we get the highest resolution result possible, even though we analyzed a compressed version.
          // Since bounding boxes are normalized (0-1000), they apply correctly to the original image too.
          const croppedImage = await cropImage(base64Image, item.box_2d, 0.01);
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
 * Searches for a better product image online using Google Search.
 * Supports multimodal input (text + image) for better accuracy.
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
    const parts: any[] = [];
    
    // If an image is provided, include it in the request to help Gemini "see" what we are looking for
    if (base64Image) {
        // Optimize image for the search query too
        const optimized = await prepareImageForAPI(base64Image);
        const cleanBase64 = optimized.split(',')[1] || optimized;
        parts.push({
            inlineData: {
                mimeType: "image/jpeg",
                data: cleanBase64
            }
        });
    }

    parts.push({
      text: `You are a smart shopping assistant.
        User Input: "${query}"
        
        GOAL: Find a **Google Images Thumbnail** URL for this product.
        
        CONTEXT: The user is on a mobile app that cannot load images from retailer websites due to CORS/Hotlink blocking. 
        We **MUST** use the Google cached version (starting with 'https://encrypted-tbn' or 'https://lh3.googleusercontent').

        INSTRUCTIONS:
        1. Search for "${query}".
        2. Scan the search results.
        3. **PRIORITY**: Extract an 'encrypted-tbn' image URL. This is the most important step.
        4. If you find a 'encrypted-tbn' URL, use it as 'imageUrl'.
        5. If you absolutely cannot find a thumbnail, return null for 'imageUrl'. Do NOT return a direct retailer link (like amazon.com/img.jpg) as it will fail.
        6. Always provide the 'sourceUrl' (the product page URL) so the user can visit it.
        
        JSON Response Format:
        \`\`\`json
        {
          "imageUrl": "https://encrypted-tbn0.gstatic.com/images?q=...", 
          "sourceUrl": "https://www.example.com/product/123"
        }
        \`\`\`
        `
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: parts
      },
      config: {
        tools: [{googleSearch: {}}],
      }
    });

    let text = response.text || '';
    
    if (!text) {
      return {
        success: false,
        error: "No response from AI service.",
        suggestion: "Please try searching again in a moment."
      };
    }

    // Clean up markdown code blocks if present
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // Parse JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const data = JSON.parse(jsonMatch[0]);
            
            // Validate URL format
            let imgUrl = data.imageUrl;
            if (imgUrl && (!imgUrl.startsWith('http') || imgUrl.length < 10)) imgUrl = null;

            let srcUrl = data.sourceUrl;
            if (srcUrl && !srcUrl.startsWith('http')) srcUrl = null;

            // If Gemini returned null for image but found a source, try to fallback or just return what we have
            if (imgUrl || srcUrl) {
                return {
                  success: true,
                  data: {
                    imageUrl: imgUrl || '', // UI will handle empty/null
                    sourceUrl: srcUrl || ''
                  }
                };
            }
        } catch (e) {
            console.warn("JSON parse error", e);
        }
    }

    // Fallback: Check grounding chunks for real links if JSON failed or was empty
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks && chunks.length > 0) {
        // Try to find a chunk that looks like a product page
        const firstWeb = chunks.find((c: any) => c.web?.uri)?.web;
        if (firstWeb) {
            return {
                success: true,
                data: {
                    imageUrl: '', // No image found in metadata usually
                    sourceUrl: firstWeb.uri
                }
            };
        }
    }
    
    return {
      success: false,
      error: "No matching items found online.",
      suggestion: "Try simplifying the name (e.g. 'Pink Floral Pajamas')."
    };

  } catch (error: any) {
    console.error("Online Search Error:", error);
    return {
      success: false,
      error: "Connection failed.",
      suggestion: "Please try again."
    };
  }
};