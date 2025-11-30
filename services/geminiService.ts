import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Category, Season } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const itemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    brand: { type: Type.STRING, description: "Brand name. If screenshot, extract exact brand text from the item row." },
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
        Category.Accessory
      ],
      description: "Category of the item."
    },
    seasons: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: [Season.Spring, Season.Summer, Season.Fall, Season.Winter, Season.All] },
      description: "Suitable seasons."
    },
    description: { type: Type.STRING, description: "Detailed product name. Capture exact text from screenshot if available." },
    box_2d: {
      type: Type.ARRAY,
      items: { type: Type.INTEGER },
      description: "The TIGHTEST POSSIBLE bounding box [ymin, xmin, ymax, xmax] (0-1000) encompassing ONLY the garment. Exclude hangers, background, and white padding."
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

/**
 * Crops a specific region from a base64 image.
 * @param base64 The full source image
 * @param box [ymin, xmin, ymax, xmax] in 0-1000 scale
 * @param paddingPct Optional percentage of padding to add. Defaults to 0 for strict cropping.
 */
const cropImage = (base64: string, box: number[], paddingPct: number = 0): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const [ymin, xmin, ymax, xmax] = box;
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      // Convert 1000 scale to pixels
      const y = (ymin / 1000) * h;
      const x = (xmin / 1000) * w;
      const boxH = ((ymax - ymin) / 1000) * h;
      const boxW = ((xmax - xmin) / 1000) * w;

      // Validate dimensions to prevent 0-width crops or tiny noise
      if (boxW < 5 || boxH < 5) {
        // Too small to be valid, return original or handle error
        resolve(base64); 
        return;
      }

      // Calculate padding pixels based on box size
      const padX = boxW * paddingPct;
      const padY = boxH * paddingPct;

      // Calculate final start coordinates with clamping to 0
      const finalX = Math.max(0, x - padX);
      const finalY = Math.max(0, y - padY);
      
      // Calculate desired final width/height including padding
      let finalW = boxW + (padX * 2);
      let finalH = boxH + (padY * 2);

      // Clamp width/height so we don't exceed source image boundaries
      if (finalX + finalW > w) finalW = w - finalX;
      if (finalY + finalH > h) finalH = h - finalY;

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

        // Fill white background first (safe default for transparent PNGs)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, finalW, finalH);
        
        // Draw the specific region from the source image onto the canvas
        ctx.drawImage(
          img, 
          finalX, finalY,   // Source start X, Y
          finalW, finalH,   // Source width, height
          0, 0,             // Destination start X, Y
          finalW, finalH    // Destination width, height
        );
        
        // Use higher quality JPEG
        resolve(canvas.toDataURL('image/jpeg', 0.98)); 
      } else {
        resolve(base64); 
      }
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
};

export const analyzeClothingImage = async (base64Image: string): Promise<any[]> => {
  // Remove header if present for API
  const cleanBase64 = base64Image.split(',')[1] || base64Image;

  try {
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
      
      GOAL: Accurate detection and PRECISE cropping of clothing items.

      Tasks:
      1. Detect distinct clothing items.
      
      2. DIGITAL SCREENSHOTS (e.g. Online Store Cart/History):
         - Identify each product row.
         - **box_2d**: Draw the box STRICTLY around the product thumbnail image. 
         - **Exclude**: Text descriptions, price tags, quantity buttons, and white whitespace margins.
         - Extract metadata (Brand/Size) from the adjacent text.

      3. REAL PHOTOS (e.g. Flat Lay or Hanger):
         - **box_2d**: Draw the box EXTREMELY TIGHTLY around the garment fabric.
         - **Exclude**: The hanger hook (crop it out).
         - **Exclude**: Background clutter, floor, bed sheets, or shadows.
         - If worn: Crop to the garment, excluding the person's face/hands if possible.
      
      4. Return a list of items found.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: multiItemSchema,
        thinkingConfig: { thinkingBudget: 2048 }, 
        systemInstruction: `You are an expert fashion image analyzer.
        
        YOUR PRIORITY IS THE BOUNDING BOX QUALITY.
        - The box must be as small as possible while containing the entire garment.
        - Do not include "air" or background around the item.
        - For screenshots, distinguish between the product image and the UI elements.
        - Ignore non-clothing items unless they are accessories.
        
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
         // Typical clothes are between 0.3 (tall dress) and 3.0 (wide belt/shoes)
         if (ratio > 5 || ratio < 0.2) return item; 
         
        try {
          // Pass the original base64Image (with header if it had one) to the crop function
          const croppedImage = await cropImage(base64Image, item.box_2d, 0);
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
        const cleanBase64 = base64Image.split(',')[1] || base64Image;
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