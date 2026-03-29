
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { ShopPost, AnalyzedShopItem, ClothingItem } from '../types';
import { analyzeShopPost, matchItemsToCloset } from '../services/geminiService';
import { useActiveChild } from '../hooks/useActiveChild';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { Loader2, X, ImagePlus, Check, ShoppingBag, Sparkles, Trash2, AlertCircle } from 'lucide-react';
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
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const focusTrapRef = useFocusTrap(true);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisError(null);
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
      setAnalysisError(e instanceof Error ? e.message : 'Analysis failed. Please try again.');
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
    <div
      ref={focusTrapRef}
      role="dialog"
      aria-modal="true"
      aria-label="Outfit details"
      className="fixed inset-0 z-[100] flex flex-col"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative mt-auto bg-orange-50 dark:bg-slate-900 rounded-t-[2rem] max-h-[90dvh] flex flex-col overflow-hidden">
        <div className="sticky top-0 bg-orange-50 dark:bg-slate-900 rounded-t-[2rem] px-6 pt-5 pb-3 z-10">
          <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-bold text-headline text-slate-800 dark:text-slate-50">Outfit Details</h2>
            <div className="flex gap-2">
              <button
                onClick={onDelete}
                aria-label="Delete post"
                className="w-11 h-11 flex items-center justify-center rounded-full bg-red-50 text-red-400"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={onClose}
                aria-label="Close details"
                className="w-11 h-11 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 shadow-sm text-slate-400 dark:text-slate-400"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-8">
          <div className="rounded-2xl overflow-hidden shadow-sm border border-slate-100 dark:border-slate-700 mb-5">
            <img src={post.image} alt="Outfit inspo" className="w-full h-auto" />
          </div>

          {analysisError && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-2xl p-4 mb-4 flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle size={18} />
                <span className="text-body font-medium">{analysisError}</span>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className="px-6 py-3 rounded-full font-bold text-white bg-red-500 hover:bg-red-600 active:scale-[0.98] transition-all"
              >
                Try Again
              </button>
            </div>
          )}

          {analyzedItems.length === 0 && !analysisError ? (
            <button
              onClick={handleAnalyze}
              disabled={analyzing}
              className="w-full py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-sky-600 to-blue-600 shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              {analyzing ? (
                <><Loader2 size={18} className="animate-spin" /> Analyzing outfit...</>
              ) : (
                <><Sparkles size={18} /> Analyze & Match to My Closet</>
              )}
            </button>
          ) : analyzedItems.length > 0 ? (
            <>
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 mb-4 border border-slate-100 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-serif font-bold text-slate-800 dark:text-slate-50">Detected Items</h3>
                  <span className="text-footnote font-medium text-slate-400 dark:text-slate-400">{totalItems} pieces</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {analyzedItems.map((item, i) => (
                    <span key={i} className="px-3 py-1.5 bg-orange-50 dark:bg-slate-900 rounded-full text-footnote font-medium text-slate-600 dark:text-slate-300">
                      {item.color} {item.category}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-serif font-bold text-slate-800 dark:text-slate-50">Closet Match</h3>
                  <span className={clsx(
                    "text-footnote font-bold px-2 py-1 rounded-full",
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
                        hasMatch ? "bg-green-50/50 border-green-100" : "bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700"
                      )}>
                        <div className="flex items-center gap-2 mb-2">
                          {hasMatch ? <Check size={14} className="text-green-500" /> : <ShoppingBag size={14} className="text-slate-400 dark:text-slate-400" />}
                          <span className="text-body font-medium text-slate-700 dark:text-slate-200">{match.shopItemDescription}</span>
                        </div>
                        {hasMatch ? (
                          <div className="flex gap-2">
                            {matchedItems.map(item => (
                              <div key={item.id} className="w-12 h-12 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-700">
                                <img src={item.image} alt="" className="w-full h-full object-cover" />
                              </div>
                            ))}
                            <span className="text-caption font-medium text-green-600 self-center ml-1">{match.matchReason}</span>
                          </div>
                        ) : (
                          <p className="text-footnote text-slate-400 dark:text-slate-400 font-medium">Not in your closet yet</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
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

  // Auto-create inspo account on first load
  useEffect(() => {
    (async () => {
      const existing = await db.shopAccounts.where('handle').equals('_inspo').first();
      if (!existing) {
        await db.shopAccounts.add({ handle: '_inspo', displayName: 'My Inspo', profileId: activeChildId ?? undefined });
      }
    })();
  }, [activeChildId]);

  const inspoAccount = useLiveQuery(
    () => db.shopAccounts.where('handle').equals('_inspo').first(),
    [activeChildId]
  );

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
        <h1 className="text-largeTitle text-slate-800 dark:text-slate-50 font-serif">Inspo</h1>
        <button
          onClick={() => fileInputRef.current?.click()}
          aria-label="Add outfit inspiration"
          className="flex items-center gap-1 text-body font-bold text-orange-500 active:scale-95 transition-transform"
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
          <h3 className="font-serif font-bold text-headline text-slate-800 dark:text-slate-50 mb-2">Save Outfit Inspo</h3>
          <p className="text-body text-slate-400 dark:text-slate-400 font-medium max-w-[240px] mx-auto mb-6">
            Upload screenshots of outfits you love. AI will analyze them and match to your closet.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-6 py-3 bg-orange-600 text-white font-bold rounded-full shadow-md active:scale-95 transition-transform"
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
              className="relative aspect-square rounded-xl overflow-hidden cursor-pointer border border-slate-100 dark:border-slate-700 active:scale-95 transition-transform"
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
