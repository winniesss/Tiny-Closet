import Dexie, { type Table } from 'dexie';
import { ClothingItem, ChildProfile, OutfitLike } from './types';

class ClosetDatabase extends Dexie {
  items!: Table<ClothingItem, number>;
  profile!: Table<ChildProfile, number>;
  outfitLikes!: Table<OutfitLike, number>;

  constructor() {
    super('KidsClosetDB');
    (this as any).version(2).stores({
      items: '++id, brand, sizeLabel, category, dateAdded, isArchived',
      profile: '++id, name',
      outfitLikes: '++id, *itemIds, style, date'
    });
  }
}

export const db = new ClosetDatabase();

// Seed profile if empty
(db as any).on('populate', () => {
  db.profile.add({
    name: 'My Kid',
    birthDate: new Date().toISOString().split('T')[0] // Default to today
  });
});