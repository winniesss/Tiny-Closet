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
  Dress = 'Dress',
  Skirt = 'Skirt',
  Pajamas = 'Pajamas',
  Swimwear = 'Swimwear',
  Shoes = 'Shoes',
  Outerwear = 'Outerwear',
  Accessory = 'Accessory',
  Underwear = 'Underwear',
  Sock = 'Sock'
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
  isFavorite?: boolean;
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