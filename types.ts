

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
  Shoes = 'Shoes',
  Outerwear = 'Outerwear',
  Accessory = 'Accessory',
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
  ignoreOutgrown?: boolean;
}

export interface OutfitLike {
  id?: number;
  itemIds: number[]; // IDs of items in the outfit
  style: 'playful' | 'chic';
  date: number;
}

export interface ChildProfile {
  id?: number;
  name: string;
  birthDate: string;
  avatar?: string; // Base64 image string
}

export interface WeatherData {
  condition: 'Sunny' | 'Cloudy' | 'Rainy' | 'Snowy' | 'Windy';
  temp: number;
  description: string;
}