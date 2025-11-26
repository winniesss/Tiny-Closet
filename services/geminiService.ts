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
      description: "The PRECISE bounding box [ymin, xmin, ymax, xmax] (0-1000) of the clothing item. Shrink wrap the box to the garment's edges. DO NOT include the product container/card borders. DO NOT include price text or 'Add' buttons. EXCLUDE all whitespace padding."
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
 * @param paddingPct Optional percentage of padding to add (e.g., 0.05 for 5%). Defaults to 0 for strict cropping.
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
      if (boxW < 1 || boxH < 1) {
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
      if (finalX + finalW > w) {
        finalW = w - finalX;
      }
      if (finalY + finalH > h) {
        finalH = h - finalY;
      }

      // Final safety check: ensure positive dimensions
      if (finalW <= 0 || finalH <= 0) {
         console.warn("Invalid crop dimensions calculated, returning original.", { finalW, finalH });
         resolve(base64);
         return;
      }

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
        
        // Draw the specific region from the source image onto the canvas
        ctx.drawImage(
          img, 
          finalX, finalY,   // Source start X, Y
          finalW, finalH,   // Source width, height
          0, 0,             // Destination start X, Y
          finalW, finalH    // Destination width, height
        );
        
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
            text: `Analyze this image (screenshot or photo) for a closet inventory app.

Task:
1. Detect all distinct clothing items.
2. For each item, determine the **exact pixel boundaries** of the garment itself.
3. Return a 'box_2d' [ymin, xmin, ymax, xmax] (0-1000 scale) that is **strictly tight** to the item.
   - **CRITICAL**: If this is a screenshot, the item is likely inside a 'card' or container. You MUST exclude the container boundaries.
   - **CRITICAL**: Crop out any 'white space' or padding around the item.
   - **CRITICAL**: Exclude hangers, mannequin heads, text overlays, price tags, and UI buttons.
4. Extract metadata: Brand, Size, Color, Category, Seasons, Description. Use text from the image if available.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: multiItemSchema,
        // Increased thinking budget for pixel-perfect reasoning
        thinkingConfig: { thinkingBudget: 2048 }, 
        systemInstruction: `You are a specialized Fashion Object Detection AI. 
Your goal is to generate bounding boxes for cropping product thumbnails.
The most common error is including the "white box" surrounding a product in a screenshot.
YOU MUST AVOID THIS.
Your bounding box should be TIGHT against the fabric of the clothing.
If there is a 10% margin of white space between the sleeve and the border, shrink your box to eliminate it.
Treat the 'box_2d' as a scissor cut. Anything inside stays, anything outside is gone.
Do not cut off parts of the garment, but do not include background noise.`,
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
    
    if (!text) {
      return {
        success: false,
        error: "No response from AI service.",
        suggestion: "Please try searching again in a moment."
      };
    }

    // Clean up markdown code blocks if present
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    // Robust JSON extraction using Regex to find the first JSON object
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            const data = JSON.parse(jsonMatch[0]);
            if (data.imageUrl && (data.imageUrl.startsWith('http') || data.imageUrl.startsWith('data:image'))) {
                return {
                  success: true,
                  data: {
                    imageUrl: data.imageUrl,
                    sourceUrl: data.sourceUrl || ''
                  }
                };
            }
        } catch (e) {
            console.warn("JSON parse error", e);
        }
    }
    
    // Fallback: If JSON parsing fails, try to extract a URL directly from text
    const urlMatch = text.match(/https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp)/i);
    if (urlMatch) {
        return {
          success: true,
          data: {
            imageUrl: urlMatch[0],
            sourceUrl: ""
          }
        };
    }
    
    return {
      success: false,
      error: "No matching images found.",
      suggestion: "Try removing specific details like size (e.g. '4T') or add the brand name if missing."
    };

  } catch (error: any) {
    console.error("Online Search Error:", error);
    
    let msg = "Search failed due to a technical issue.";
    let suggestion = "Check your internet connection and try again.";

    if (error.message?.includes('400') || error.message?.includes('API key')) {
      msg = "Service configuration error.";
      suggestion = "Please verify API Key settings.";
    } else if (error.message?.includes('quota') || error.message?.includes('429')) {
      msg = "Search limit reached.";
      suggestion = "Please try again in a few minutes.";
    }

    return {
      success: false,
      error: msg,
      suggestion: suggestion
    };
  }
};