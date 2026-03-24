
export enum Season {
  Spring = 'Spring',
  Summer = 'Summer',
  Fall = 'Fall',
  Winter = 'Winter',
  All = 'All Year'
}

export enum Category {
  Top = 'Top',
  Bottom = 'Bottom',
  FullBody = 'Full Body',
  Romper = 'Romper',
  Overall = 'Overall',
  Shoes = 'Shoes',
  Outerwear = 'Outerwear',
  Vest = 'Vest',
  Accessory = 'Accessory',
  Tights = 'Tights',
  Pajamas = 'Pajamas',
  Swimwear = 'Swimwear',
  Socks = 'Socks'
}

export interface ClothingItem {
  id?: number;
  image: string; // Base64
  brand: string;
  sizeLabel: string;
  category: Category;
  color: string;
  seasons: Season[];
  description?: string;
  dateAdded: number;
  isArchived?: boolean;
  dateArchived?: number;
  ignoreOutgrown?: boolean;
  profileId?: number;
  wearCount?: number;
  lastWorn?: number;
}

export interface OutfitLike {
  id?: number;
  itemIds: number[]; // IDs of items in the outfit
  style: 'playful' | 'chic';
  date: number;
  profileId?: number;
}

export interface ChildProfile {
  id?: number;
  name: string;
  birthDate: string;
  avatar?: string; // Base64 image string
}

export interface WeeklyPlan {
  id?: number;
  profileId?: number;
  date: string; // YYYY-MM-DD format
  itemIds: number[]; // IDs of clothing items for this day
}

export interface WeatherData {
  condition: 'Sunny' | 'Cloudy' | 'Rainy' | 'Snowy' | 'Windy';
  temp: number;
  description: string;
}

export interface ShopAccount {
  id?: number;
  handle: string;
  displayName?: string;
  profileImageUrl?: string;
  lastFetched?: number;
  profileId?: number;
}

export interface AnalyzedShopItem {
  category: Category;
  color: string;
  description: string;
  seasons: Season[];
}

export interface ShopPost {
  id?: number;
  shopAccountId: number;
  postUrl: string;
  image: string; // base64
  dateFetched: number;
  analyzedItems?: AnalyzedShopItem[];
  isProcessed: boolean;
}

export interface MatchResult {
  shopItemDescription: string;
  shopItemCategory: Category;
  matchedClosetItemIds: number[];
  matchScore: number;
  matchReason: string;
}

export interface OutfitMatch {
  id?: number;
  shopPostId: number;
  profileId?: number;
  matchResults: MatchResult[];
  dateMatched: number;
}
