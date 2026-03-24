
import React, { useState, useMemo, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ShopPost, AnalyzedShopItem, ClothingItem } from '../types';
import { analyzeShopPost, matchItemsToCloset } from '../services/geminiService';
import { useActiveChild } from '../hooks/useActiveChild';
import { Loader2, X, ImagePlus, Check, ShoppingBag, Sparkles, Trash2 } from 'lucide-react';
import clsx from 'clsx';

// --- Post Detail Modal ---
const PostDetailModal: React.FC<{
  post: ShopPost;
  closetItems: ClothingItem[];
  onClose: () => void;
  onDelete: () => void;
}> = ({ post, closetItems, onClose, onDelete }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzedItems, setAnalyzedItems] = useState<AnalyzedShopItem[]>(post.analyzedItems || []);
  const [matches, setMatches] = useState<ReturnType<typeof matchItemsToCloset>>([]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const items = await analyzeShopPost(post.image);
      setAnalyzedItems(items);
      if (post.id) {
        await db.shopPosts.update(post.id, { analyzedItems: items, isProcessed: true });
      }
      const matchResults = matchItemsToCloset(items, closetItems);
      setMatches(matchResults);
    } catch (e) {
      console.error('Analysis failed:', e);
    } finally {
      setAnalyzing(false);
    }
  };

  React.useEffect(() => {
    if (analyzedItems.length > 0 && matches.length === 0) {
      const matchResults = matchItemsToCloset(analyzedItems, closetItems);
      setMatches(matchResults);
    }
  }, [analyzedItems, closetItems]);

  const totalItems = analyzedItems.length;
  const matchedCount = matches.filter(m => m.matchedClosetItemIds.length > 0).length;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mt-auto bg-orange-50 rounded-t-[2rem] max-h-[90dvh] flex flex-col overflow-hidden">
        <div className="sticky top-0 bg-orange-50 rounded-t-[2rem] px-6 pt-5 pb-3 z-10">
          <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-bold text-lg text-slate-800">Outfit Details</h2>
            <div className="flex gap-2">
              <button onClick={onDelete} className="p-2 rounded-full bg-red-50 text-red-400">
                <Trash2 size={16} />
              </button>
              <button onClick={onClose} className="p-2 rounded-full bg-white shadow-sm text-slate-400">
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-8">
          <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-100 mb-5">
            <img src={post.image} alt="Outfit inspo" className="w-full h-auto" />
          </div>

          {analyzedItems.length === 0 ? (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-sky-400 to-blue-500 shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              {analyzing ? (
                <><Loader2 size={18} className="animate-spin" /> Analyzing outfit...</>
              ) : (
                <><Sparkles size={18} /> Analyze & Match to My Closet</>
              )}
            </button>
          ) : (
            <>
              <div className="bg-white rounded-2xl p-4 mb-4 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-serif font-bold text-slate-800">Detected Items</h3>
                  <span className="text-xs font-bold text-slate-400">{totalItems} pieces</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {analyzedItems.map((item, i) => (
                    <span key={i} className="px-3 py-1.5 bg-orange-50 rounded-full text-xs font-bold text-slate-600">
                      {item.color} {item.category}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-serif font-bold text-slate-800">Closet Match</h3>
                  <span className={clsx(
                    "text-xs font-bold px-2 py-1 rounded-full",
                    matchedCount === totalItems ? "bg-green-100 text-green-600" :
                    matchedCount > 0 ? "bg-orange-100 text-orange-600" : "bg-red-100 text-red-500"
                  )}>
                    {matchedCount}/{totalItems} matched
                  </span>
                </div>
                <div className="space-y-3">
                  {matches.map((match, i) => {
                    const hasMatch = match.matchedClosetItemIds.length > 0;
                    const matchedItems = match.matchedClosetItemIds
                      .slice(0, 3)
                      .map(id => closetItems.find(c => c.id === id))
                      .filter(Boolean) as ClothingItem[];
                    return (
                      <div key={i} className={clsx(
                        "rounded-xl p-3 border",
                        hasMatch ? "bg-green-50/50 border-green-100" : "bg-slate-50 border-slate-100"
                      )}>
                        <div className="flex items-center gap-2 mb-2">
                          {hasMatch ? <Check size={14} className="text-green-500" /> : <ShoppingBag size={14} className="text-slate-400" />}
                          <span className="text-sm font-bold text-slate-700">{match.shopItemDescription}</span>
                        </div>
                        {hasMatch ? (
                          <div className="flex gap-2">
                            {matchedItems.map(item => (
                              <div key={item.id} className="w-12 h-12 rounded-lg overflow-hidden border border-slate-100">
                                <img src={item.image} alt="" className="w-full h-full object-cover" />
                              </div>
                            ))}
                            <span className="text-[10px] font-bold text-green-600 self-center ml-1">{match.matchReason}</span>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 font-bold">Not in your closet yet</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Main ShopInspo Component ---
export const ShopInspo: React.FC = () => {
  const { activeChildId } = useActiveChild();
  const [selectedPost, setSelectedPost] = useState<ShopPost | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use a default "inspo" account — auto-created
  const inspoAccount = useLiveQuery(async () => {
    let account = await db.shopAccounts.where('handle').equals('_inspo').first();
    if (!account) {
      const id = await db.shopAccounts.add({ handle: '_inspo', displayName: 'My Inspo', profileId: activeChildId ?? undefined });
      account = await db.shopAccounts.get(id);
    }
    return account;
  }, [activeChildId]);

  const posts = useLiveQuery(
    () => inspoAccount?.id
      ? db.shopPosts.where('shopAccountId').equals(inspoAccount.id).reverse().toArray()
      : Promise.resolve([] as ShopPost[]),
    [inspoAccount?.id]
  );

  const allItemsRaw = useLiveQuery(() => db.items.filter(i => !i.isArchived).toArray());
  const closetItems = useMemo(() => {
    if (!allItemsRaw) return [];
    return allItemsRaw.filter(item => {
      if (!activeChildId) return true;
      return !item.profileId || item.profileId === activeChildId;
    });
  }, [allItemsRaw, activeChildId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!inspoAccount?.id || !e.target.files) return;
    const files = Array.from(e.target.files);
    for (const file of files) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      await db.shopPosts.add({
        shopAccountId: inspoAccount.id,
        postUrl: `inspo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        image: base64,
        dateFetched: Date.now(),
        isProcessed: false,
      });
    }
    if (e.target) e.target.value = '';
  };

  const handleDeletePost = async (postId: number) => {
    await db.shopPosts.delete(postId);
    setSelectedPost(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-baseline">
        <h1 className="text-3xl text-slate-800 font-serif">Inspo</h1>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 text-sm font-bold text-orange-500 active:scale-95 transition-transform"
        >
          <ImagePlus size={16} /> Add
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      {!posts || posts.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <ImagePlus size={32} className="text-orange-400" />
          </div>
          <h3 className="font-serif font-bold text-lg text-slate-800 mb-2">Save Outfit Inspo</h3>
          <p className="text-sm text-slate-400 font-bold max-w-[240px] mx-auto mb-6">
            Upload screenshots of outfits you love. AI will analyze them and match to your closet.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-3 bg-orange-400 text-white font-bold rounded-full shadow-md active:scale-95 transition-transform"
          >
            Upload First Outfit
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {posts.map(post => (
            <div
              key={post.id}
              onClick={() => setSelectedPost(post)}
              className="relative aspect-square rounded-xl overflow-hidden cursor-pointer border border-slate-100 active:scale-95 transition-transform"
            >
              <img src={post.image} alt="" className="w-full h-full object-cover" />
              {post.isProcessed && (
                <div className="absolute top-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                  <Check size={10} className="text-white" strokeWidth={3} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          closetItems={closetItems}
          onClose={() => setSelectedPost(null)}
          onDelete={() => handleDeletePost(selectedPost.id!)}
        />
      )}
    </div>
  );
};
