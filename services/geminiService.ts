import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Category, Season } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const itemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    brand: { type: Type.STRING, description: "Brand name. If screenshot, extract exact brand text." },
    sizeLabel: { type: Type.STRING, description: "Size on tag (e.g., 2T, 6M, 5Y)." },
    color: { type: Type.STRING, description: "Primary color." },
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
      description: "The PRECISE visual bounding box [ymin, xmin, ymax, xmax] (0-1000) of the item.\n\nCRITICAL INSTRUCTIONS:\n1. EXCLUDE all background whitespace, shadows, and UI cards.\n2. EXCLUDE model's face, arms, and legs if possible - crop to the garment.\n3. IGNORE hanger hooks if visible.\n4. HUG the fabric edges as tightly as possible, especially around complex textures like lace or frills."
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

/**
 * Crops a specific region from a base64 image.
 * @param base64 The full source image
 * @param box [ymin, xmin, ymax, xmax] in 0-1000 scale
 */
const cropImage = (base64: string, box: number[]): Promise<string> => {
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

      // Validate dimensions to prevent 0-width crops
      if (boxW < 10 || boxH < 10) {
        resolve(base64); 
        return;
      }

      // No padding, strict crop based on AI instructions
      const paddingX = 0;
      const paddingY = 0;

      const finalX = Math.max(0, x - paddingX);
      const finalY = Math.max(0, y - paddingY);
      const finalW = Math.min(w - finalX, boxW + (paddingX * 2));
      const finalH = Math.min(h - finalY, boxH + (paddingY * 2));

      const canvas = document.createElement('canvas');
      canvas.width = finalW;
      canvas.height = finalH;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // High quality scaling settings
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Fill white background first to handle transparent PNGs turning black
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, finalW, finalH);
        
        ctx.drawImage(img, finalX, finalY, finalW, finalH, 0, 0, finalW, finalH);
        resolve(canvas.toDataURL('image/jpeg', 0.95)); // High quality JPEG
      } else {
        resolve(base64); // Fallback to original if context fails
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
            text: "Analyze this image for a digital closet app.\n\nTask:\n1. Identify all distinct clothing items.\n2. For each item, draw a 'box_2d' that acts as a tight crop for a sticker.\n3. IGNORE the white square container often found in screenshots; crop to the FABRIC inside it.\n4. Extract brand, size, and description from any visible text."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: multiItemSchema,
        thinkingConfig: { thinkingBudget: 1024 }, // Enable thinking for better spatial reasoning
        systemInstruction: "You are a specialized Computer Vision AI. Your task is to detect clothing items in images with pixel-perfect precision. You must distinguish between the 'garment' and the 'container/background'. Your bounding boxes must be extremely tight to the fabric, minimizing whitespace. Ignore hanger hooks and shadows.",
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
         
         // Filter 1: Inverted coordinates
         if (height <= 0 || width <= 0) return item;

         // Filter 2: Extreme Aspect Ratios (likely text lines or UI bars)
         // e.g., Width is 6x Height -> Text line
         if (width > height * 6) return item;
         
        try {
          // Pass the original base64Image (with header if it had one) to the crop function
          const croppedImage = await cropImage(base64Image, item.box_2d);
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
export const findBetterItemImage = async (query: string, base64Image?: string): Promise<{imageUrl?: string, sourceUrl?: string} | null> => {
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
      text: `You are an API that finds clean product images.
        User Query: "${query}"
        
        Task:
        1. Search for this specific children's clothing item. Use the image to match visual style/pattern.
        2. Find a high-resolution, isolated product shot (white or clean background).
        3. Return JSON.
        
        JSON Format:
        \`\`\`json
        {
          "imageUrl": "https://example.com/image.jpg",
          "sourceUrl": "https://example.com/product-page"
        }
        \`\`\`
        
        If no perfect isolated image exists, return the best clear view found.`
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
    
    if (!text) return null;

    // Clean up markdown code blocks if present
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // Robust JSON extraction using Regex to find the first JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const data = JSON.parse(jsonMatch[0]);
            if (data.imageUrl && (data.imageUrl.startsWith('http') || data.imageUrl.startsWith('data:image'))) {
                return data;
            }
        } catch (e) {
            console.warn("JSON parse error", e);
        }
    }
    
    // Fallback: If JSON parsing fails, try to extract a URL directly from text
    const urlMatch = text.match(/https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp)/i);
    if (urlMatch) {
        return {
            imageUrl: urlMatch[0],
            sourceUrl: ""
        };
    }
    
    return null;
  } catch (error) {
    console.error("Online Search Error:", error);
    return null;
  }
};