import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Category, Season } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const itemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    brand: { type: Type.STRING, description: "Brand name if visible, or 'Unknown'" },
    sizeLabel: { type: Type.STRING, description: "Size on tag (e.g., 2T, 6M, 5Y), or estimate" },
    color: { type: Type.STRING, description: "Primary color of the item" },
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
      description: "Category of the clothing item"
    },
    seasons: {
      type: Type.ARRAY,
      items: { type: Type.STRING, enum: [Season.Spring, Season.Summer, Season.Fall, Season.Winter, Season.All] },
      description: "Suitable seasons for this item"
    },
    description: { type: Type.STRING, description: "Short description (e.g., 'Blue dinosaur t-shirt')" },
    box_2d: {
      type: Type.ARRAY,
      items: { type: Type.INTEGER },
      description: "Bounding box [ymin, xmin, ymax, xmax] in 0-1000 scale of the item in the image."
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
      description: "List of all distinct clothing items identified in the image."
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

      // Add a small padding (5%) to the crop so it's not too tight
      const paddingX = boxW * 0.05;
      const paddingY = boxH * 0.05;

      const finalX = Math.max(0, x - paddingX);
      const finalY = Math.max(0, y - paddingY);
      const finalW = Math.min(w - finalX, boxW + (paddingX * 2));
      const finalH = Math.min(h - finalY, boxH + (paddingY * 2));

      const canvas = document.createElement('canvas');
      canvas.width = finalW;
      canvas.height = finalH;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, finalX, finalY, finalW, finalH, 0, 0, finalW, finalH);
        resolve(canvas.toDataURL('image/jpeg'));
      } else {
        resolve(base64); // Fallback to original if context fails
      }
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
};

export const analyzeClothingImage = async (base64Image: string): Promise<any[]> => {
  // Remove header if present (data:image/jpeg;base64,) for the API call
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
            text: "Analyze this image. It is either a photo of clothing or a screenshot of an order (which may contain multiple items). Identify ALL distinct clothing items. IMPORTANT: For every item, provide the bounding box (box_2d) so we can crop the specific item image."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: multiItemSchema,
        systemInstruction: "You are an expert children's fashion assistant. Identify clothing details accurately from photos or screenshots.",
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const parsed = JSON.parse(text);
    const items = parsed.items || [];

    // Process items to crop images if bounding boxes exist
    const processedItems = await Promise.all(items.map(async (item: any) => {
      if (item.box_2d && Array.isArray(item.box_2d) && item.box_2d.length === 4) {
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
 */
export const findBetterItemImage = async (brand: string, description: string, color: string): Promise<{imageUrl?: string, sourceUrl?: string} | null> => {
  const query = `${brand} ${color} ${description} kids clothing product image`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [{
          text: `Perform a Google Search for: "${query}".
          Look for a high-quality, isolated product image (white background preferred) from a retail site.
          
          Extract the most promising image URL found in the search results.
          
          Respond with a strict JSON object:
          {
            "imageUrl": "THE_IMAGE_URL",
            "sourceUrl": "THE_SOURCE_PAGE_URL"
          }
          
          If you cannot find a direct image URL in the search results, return null.`
        }]
      },
      config: {
        tools: [{googleSearch: {}}],
        // responseSchema is NOT allowed when using tools like googleSearch
      }
    });

    const text = response.text;
    console.log("Search response raw:", text); 
    
    if (!text) return null;

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
    
    return null;
  } catch (error) {
    console.error("Online Search Error:", error);
    return null;
  }
};
