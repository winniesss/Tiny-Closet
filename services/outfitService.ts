
import { ClothingItem, Category, Season, WeatherData, DayType } from '../types';

// --- Color Utilities ---

export const PALETTES = {
  neutrals: ['white', 'black', 'grey', 'gray', 'beige', 'cream', 'ivory', 'oat', 'stone', 'charcoal'],
  earthy: ['sage', 'olive', 'clay', 'terracotta', 'rust', 'mustard', 'brown', 'tan', 'cocoa', 'sand', 'khaki'],
  pastels: ['mint', 'blush', 'pale', 'baby blue', 'lilac', 'butter', 'peach', 'rose'],
  vibrant: ['red', 'royal', 'yellow', 'green', 'pink', 'orange']
};

export const cleanColor = (c: string) => c.toLowerCase().trim();

export const isNeutral = (color?: string) => {
  if (!color) return true;
  const c = cleanColor(color);
  return PALETTES.neutrals.some(n => c.includes(n));
};

export const isEarthy = (color?: string) => {
  if (!color) return false;
  const c = cleanColor(color);
  return PALETTES.earthy.some(n => c.includes(n));
};

export const isTonal = (c1?: string, c2?: string) => {
  if (!c1 || !c2) return false;
  const a = cleanColor(c1);
  const b = cleanColor(c2);
  return a.includes(b) || b.includes(a);
};

// --- Season from temperature ---

export function getSeasonFromTemp(temp: number): Season {
  if (temp > 25) return Season.Summer;
  if (temp > 15) return Season.Spring;
  if (temp > 5) return Season.Fall;
  return Season.Winter;
}

// --- Scoring ---

export type OutfitStyle = 'chic' | 'playful';

export function scoreMatch(
  anchor: ClothingItem,
  candidate: ClothingItem,
  style: OutfitStyle,
  topBrands: string[]
): number {
  let score = 0;
  const c1 = anchor.color;
  const c2 = candidate.color;

  // Brand Matching
  if (anchor.brand !== 'Unknown' && anchor.brand === candidate.brand) {
    score += 10;
    if (isTonal(c1, c2)) score += 5;
  }

  // Brand Affinity
  if (candidate.brand && topBrands.includes(candidate.brand)) {
    score += 3;
  }
  if (anchor.brand && topBrands.includes(anchor.brand) && candidate.brand && topBrands.includes(candidate.brand)) {
    score += 4;
  }

  // Color Theory
  if (style === 'chic') {
    if (isTonal(c1, c2)) score += 8;
    if (isNeutral(c1) && isNeutral(c2)) score += 5;
    if (isEarthy(c1) && isEarthy(c2)) score += 6;
    if (!isNeutral(c1) && !isNeutral(c2) && !isEarthy(c1) && !isEarthy(c2)) score -= 5;
  } else {
    if (isTonal(c1, c2)) score += 2;
    if (!isNeutral(c1) && isNeutral(c2)) score += 5;
    if ((isEarthy(c1) && !isEarthy(c2) && !isNeutral(c2)) || (!isEarthy(c1) && isEarthy(c2) && !isNeutral(c1))) {
      score += 6;
    }
  }

  return score;
}

// --- Outfit Building ---

export interface OutfitContext {
  allItems: ClothingItem[];
  weather: WeatherData;
  excludeItemIds?: number[];
}

function computeBrandInfo(allItems: ClothingItem[]) {
  const brandCounts: Record<string, number> = {};
  allItems.forEach(i => {
    if (i.brand && i.brand !== 'Unknown') {
      brandCounts[i.brand] = (brandCounts[i.brand] || 0) + 1;
    }
  });
  const topBrands = Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
  return { brandCounts, topBrands };
}

function pickWeightedAnchor(
  items: ClothingItem[],
  brandCounts: Record<string, number>,
  topBrands: string[]
): ClothingItem | null {
  if (items.length === 0) return null;
  const pool: ClothingItem[] = [];
  items.forEach(item => {
    let weight = (brandCounts[item.brand] || 0) + 1;
    if (topBrands.includes(item.brand)) weight += 8;
    const cap = Math.min(weight, 15);
    for (let k = 0; k < cap; k++) pool.push(item);
  });
  return pool[Math.floor(Math.random() * pool.length)];
}

export function buildOutfit(context: OutfitContext, style: OutfitStyle): ClothingItem[] {
  const { allItems, weather, excludeItemIds } = context;
  const temp = weather.temp;
  const targetSeason = getSeasonFromTemp(temp);

  const excluded = new Set(excludeItemIds || []);
  const seasonFiltered = allItems.filter(item =>
    !excluded.has(item.id!) &&
    (item.seasons.includes(targetSeason) || item.seasons.includes(Season.All))
  );
  // Fallback: if season filter is too strict, use all non-excluded items
  const suitable = seasonFiltered.length >= 2 ? seasonFiltered : allItems.filter(item => !excluded.has(item.id!));

  const tops = suitable.filter(i => i.category === Category.Top);
  const bottoms = suitable.filter(i => i.category === Category.Bottom);
  const fullBody = suitable.filter(i =>
    i.category === Category.FullBody || i.category === Category.Romper || i.category === Category.Overall
  );
  const outerwear = suitable.filter(i => i.category === Category.Outerwear || i.category === Category.Vest);
  const shoes = suitable.filter(i => i.category === Category.Shoes);
  const accessories = suitable.filter(i => i.category === Category.Accessory);

  const { brandCounts, topBrands } = computeBrandInfo(allItems);
  const outfit: ClothingItem[] = [];

  // 1. Pick Anchor
  let useFullBody = false;
  if (style === 'chic' && fullBody.length > 0 && Math.random() > 0.4) useFullBody = true;
  if (tops.length === 0 || bottoms.length === 0) {
    if (fullBody.length > 0) useFullBody = true;
    // else: just use whatever is available (top-only or bottom-only)
  }

  if (useFullBody) {
    const anchor = pickWeightedAnchor(fullBody, brandCounts, topBrands);
    if (anchor) outfit.push(anchor);
  } else if (tops.length > 0 && bottoms.length > 0) {
    const top = pickWeightedAnchor(tops, brandCounts, topBrands);
    if (!top) return [];
    outfit.push(top);

    const scoredBottoms = bottoms.map(b => ({
      item: b,
      score: scoreMatch(top, b, style, topBrands) + (Math.random() * 4)
    }));
    scoredBottoms.sort((a, b) => b.score - a.score);
    if (scoredBottoms.length > 0) outfit.push(scoredBottoms[0].item);
  } else if (tops.length > 0) {
    const top = pickWeightedAnchor(tops, brandCounts, topBrands);
    if (top) outfit.push(top);
  } else if (bottoms.length > 0) {
    const bottom = pickWeightedAnchor(bottoms, brandCounts, topBrands);
    if (bottom) outfit.push(bottom);
  } else if (suitable.length > 0) {
    // Nothing in standard categories — just pick any item
    outfit.push(suitable[Math.floor(Math.random() * suitable.length)]);
  } else {
    return [];
  }

  // 2. Outerwear
  const needsOuterwear = temp < 18 || weather.condition === 'Rainy' || weather.condition === 'Snowy' || weather.condition === 'Windy';
  if (needsOuterwear && outerwear.length > 0 && outfit.length > 0) {
    const base = outfit[0];
    const scored = outerwear.map(o => ({ item: o, score: scoreMatch(base, o, style, topBrands) }));
    scored.sort((a, b) => b.score - a.score);
    outfit.push(scored[0].item);
  }

  // 3. Shoes
  if (shoes.length > 0 && outfit.length > 0) {
    const base = outfit[0];
    const scored = shoes.map(s => ({ item: s, score: scoreMatch(base, s, style, topBrands) }));
    scored.sort((a, b) => b.score - a.score);
    outfit.push(scored[0].item);
  }

  // 4. Accessory
  if (accessories.length > 0 && outfit.length > 0) {
    const base = outfit[0];
    const scored = accessories.map(a => ({ item: a, score: scoreMatch(base, a, style, topBrands) }));
    scored.sort((a, b) => b.score - a.score);
    if (style === 'playful' || scored[0].score > 0) {
      if (Math.random() > 0.5) outfit.push(scored[0].item);
    }
  }

  return outfit;
}

// --- Day Type outfit building ---

interface DayTypeConfig {
  style: OutfitStyle;
  preferFullBody: boolean;
  alwaysAccessory: boolean;
  preferPajamas: boolean;
  skipShoes: boolean;
  excludeCategories: Category[];
}

function getDayTypeConfig(dayType: DayType): DayTypeConfig {
  switch (dayType) {
    case 'school':
      return { style: 'chic', preferFullBody: false, alwaysAccessory: false, preferPajamas: false, skipShoes: false, excludeCategories: [Category.Pajamas, Category.Swimwear] };
    case 'playdate':
      return { style: 'chic', preferFullBody: false, alwaysAccessory: false, preferPajamas: false, skipShoes: false, excludeCategories: [Category.Pajamas, Category.Swimwear] };
    case 'party':
      return { style: 'chic', preferFullBody: true, alwaysAccessory: true, preferPajamas: false, skipShoes: false, excludeCategories: [Category.Pajamas, Category.Swimwear] };
    case 'sports':
      return { style: 'playful', preferFullBody: false, alwaysAccessory: false, preferPajamas: false, skipShoes: false, excludeCategories: [Category.Pajamas, Category.Swimwear, Category.Accessory] };
    case 'stayhome':
      return { style: 'playful', preferFullBody: false, alwaysAccessory: false, preferPajamas: true, skipShoes: true, excludeCategories: [Category.Swimwear] };
  }
}

export function buildOutfitForDayType(context: OutfitContext, dayType: DayType): ClothingItem[] {
  const config = getDayTypeConfig(dayType);
  const { allItems, weather, excludeItemIds } = context;
  const temp = weather.temp;
  const targetSeason = getSeasonFromTemp(temp);

  const excluded = new Set(excludeItemIds || []);
  const excludeCats = new Set(config.excludeCategories);

  const seasonFiltered = allItems.filter(item =>
    !excluded.has(item.id!) &&
    !excludeCats.has(item.category) &&
    (item.seasons.includes(targetSeason) || item.seasons.includes(Season.All))
  );
  // Fallback: if season filter is too strict, ignore season requirement
  const suitable = seasonFiltered.length >= 2
    ? seasonFiltered
    : allItems.filter(item => !excluded.has(item.id!) && !excludeCats.has(item.category));

  // Stay Home: try pajamas first
  if (config.preferPajamas) {
    const pajamas = suitable.filter(i => i.category === Category.Pajamas);
    if (pajamas.length > 0) {
      // Just pick a pajama — that's the whole outfit for staying home
      return [pajamas[Math.floor(Math.random() * pajamas.length)]];
    }
    // No pajamas? Fall through to normal casual outfit
  }

  const { brandCounts, topBrands } = computeBrandInfo(allItems);
  const tops = suitable.filter(i => i.category === Category.Top);
  const bottoms = suitable.filter(i => i.category === Category.Bottom);
  const fullBody = suitable.filter(i =>
    i.category === Category.FullBody || i.category === Category.Romper || i.category === Category.Overall
  );
  const outerwear = suitable.filter(i => i.category === Category.Outerwear || i.category === Category.Vest);
  const shoes = suitable.filter(i => i.category === Category.Shoes);
  const accessories = suitable.filter(i => i.category === Category.Accessory);

  const outfit: ClothingItem[] = [];
  const style = config.style;

  // 1. Anchor — party prefers full body
  let useFullBody = false;
  if (config.preferFullBody && fullBody.length > 0 && Math.random() > 0.2) useFullBody = true;
  else if (style === 'chic' && fullBody.length > 0 && Math.random() > 0.4) useFullBody = true;

  if (tops.length === 0 || bottoms.length === 0) {
    if (fullBody.length > 0) useFullBody = true;
  }

  if (useFullBody) {
    const anchor = pickWeightedAnchor(fullBody, brandCounts, topBrands);
    if (anchor) outfit.push(anchor);
  } else if (tops.length > 0 && bottoms.length > 0) {
    const top = pickWeightedAnchor(tops, brandCounts, topBrands);
    if (!top) return [];
    outfit.push(top);

    const scoredBottoms = bottoms.map(b => ({
      item: b,
      score: scoreMatch(top, b, style, topBrands) + (Math.random() * 4)
    }));
    scoredBottoms.sort((a, b) => b.score - a.score);
    if (scoredBottoms.length > 0) outfit.push(scoredBottoms[0].item);
  } else if (tops.length > 0) {
    const top = pickWeightedAnchor(tops, brandCounts, topBrands);
    if (top) outfit.push(top);
  } else if (bottoms.length > 0) {
    const bottom = pickWeightedAnchor(bottoms, brandCounts, topBrands);
    if (bottom) outfit.push(bottom);
  } else if (suitable.length > 0) {
    outfit.push(suitable[Math.floor(Math.random() * suitable.length)]);
  }

  // 2. Outerwear
  const needsOuterwear = temp < 18 || weather.condition === 'Rainy' || weather.condition === 'Snowy' || weather.condition === 'Windy';
  if (needsOuterwear && outerwear.length > 0 && outfit.length > 0) {
    const base = outfit[0];
    const scored = outerwear.map(o => ({ item: o, score: scoreMatch(base, o, style, topBrands) }));
    scored.sort((a, b) => b.score - a.score);
    outfit.push(scored[0].item);
  }

  // 3. Shoes (skip for stay home)
  if (!config.skipShoes && shoes.length > 0 && outfit.length > 0) {
    const base = outfit[0];
    const scored = shoes.map(s => ({ item: s, score: scoreMatch(base, s, style, topBrands) }));
    scored.sort((a, b) => b.score - a.score);
    outfit.push(scored[0].item);
  }

  // 4. Accessory — party always adds, others 50% chance
  if (!excludeCats.has(Category.Accessory) && accessories.length > 0 && outfit.length > 0) {
    const base = outfit[0];
    const scored = accessories.map(a => ({ item: a, score: scoreMatch(base, a, style, topBrands) }));
    scored.sort((a, b) => b.score - a.score);
    if (config.alwaysAccessory) {
      outfit.push(scored[0].item);
    } else if (style === 'playful' || scored[0].score > 0) {
      if (Math.random() > 0.5) outfit.push(scored[0].item);
    }
  }

  return outfit;
}
