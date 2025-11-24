import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Category, Season } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const itemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    brand: { type: Type.STRING, description: "Brand name. If this is an order screenshot, extract the brand name from the text." },
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
    description: { type: Type.STRING, description: "Detailed product name or description. IMPORTANT: If this is an order screenshot, extract the EXACT product text found near the item." },
    box_2d: {
      type: Type.ARRAY,
      items: { type: Type.INTEGER },
      description: "EXTREMELY TIGHT bounding box [ymin, xmin, ymax, xmax] (0-1000) around the clothing item PIXELS only. STRICTLY EXCLUDE the white container box, text, prices, buttons, or UI elements."
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

      // No padding, ensuring tight crop on the product
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
        // High quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Fill white background first to handle transparent PNGs turning black
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, finalW, finalH);
        
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
            text: "Analyze this image. It is likely a screenshot of an online order or a photo of multiple items. Identify ALL distinct clothing items. \n\nCRITICAL FOR SCREENSHOTS:\n1. The 'box_2d' must strictly enclose ONLY the garment itself. Do NOT include the square product card, whitespace, price tags, or 'Add to Cart' buttons.\n2. Read the text associated with that thumbnail (product name, size, brand) and populate the 'description', 'sizeLabel', and 'brand' fields.\n\nFor photos: Detect each clothing item with a tight bounding box."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: multiItemSchema,
        systemInstruction: "You are an expert children's fashion assistant. You are excellent at identifying clothing in crowded screenshots and extracting precise, clean product thumbnails.",
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
      text: `You are an API that finds product images.
        User Query: "${query}"
        
        Instructions:
        1. Search Google for this product. Use the provided image (if any) to confirm the visual match (color, pattern).
        2. Find the best available isolated product image.
        3. Output a valid JSON object.
        
        JSON Format:
        \`\`\`json
        {
          "imageUrl": "https://example.com/image.jpg",
          "sourceUrl": "https://example.com/product-page"
        }
        \`\`\`
        
        Rules:
        - "imageUrl" must be a direct link to the image file if possible, or a high-quality preview URL found in the search results.
        - "sourceUrl" is the website where you found it.
        - If you can't find a perfect white-background image, return the best lifestyle image or screenshot you found.
        - Do NOT explain. ONLY output JSON.`
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: parts
      },
      config: {
        tools: [{googleSearch: {}}],
        // responseSchema is NOT allowed when using tools like googleSearch
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