/**
 * LookbookPickerSheet
 *
 * Slide-up sheet that lists all saved Lineup groups.
 * Each row shows a 3-thumbnail preview and a filled checkmark when the given
 * item is already in that group. Tapping adds or removes the item.
 */
import React from "react";
import { motion } from "framer-motion";
import { X, Check } from "lucide-react";
import {
  useListOutfits,
  useAddItemToOutfit,
  useRemoveItemFromOutfit,
  getListOutfitsQueryKey,
  type ClothingItem,
  type SavedOutfit,
} from "@/hooks/useLocalDB";
import { useQueryClient } from "@tanstack/react-query";
import { getImageUrl } from "@/lib/utils";

interface Props {
  item:    ClothingItem;
  onClose: () => void;
}

// ── 3-thumbnail row ───────────────────────────────────────────────────────────

function ThreeThumbs({ outfit }: { outfit: SavedOutfit }) {
  const shown = (outfit.items ?? []).slice(0, 3);
  return (
    <div className="flex gap-1">
      {Array.from({ length: 3 }).map((_, i) => {
        const item = shown[i];
        return (
          <div
            key={i}
            className="w-10 h-10 border-2 border-black rounded overflow-hidden flex-shrink-0"
            style={{ background: "#F5EDD8" }}
          >
            {item?.imageObjectPath ? (
              <img
                src={getImageUrl(item.imageObjectPath)!}
                alt={item.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-[9px] text-black/25 font-bold">—</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Sheet ─────────────────────────────────────────────────────────────────────

export function LookbookPickerSheet({ item, onClose }: Props) {
  const { data: outfits, isLoading } = useListOutfits();
  const addItem    = useAddItemToOutfit();
  const removeItem = useRemoveItemFromOutfit();
  const qc         = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListOutfitsQueryKey() });

  const handleToggle = (outfit: SavedOutfit) => {
    const isIn = (outfit.items ?? []).some((i) => i.id === item.id);
    if (isIn) {
      removeItem.mutate({ id: outfit.id, itemId: item.id }, { onSuccess: invalidate });
    } else {
      addItem.mutate({ id: outfit.id, data: { itemId: item.id } }, { onSuccess: invalidate });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[90] flex flex-col max-w-md mx-auto bg-[#EDF6FB]"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 bg-white border-b-2 border-black flex-shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "0.75rem" }}
      >
        <div>
          <h2 className="font-display font-bold text-xl uppercase tracking-tight">
            Add to Lineup
          </h2>
          <p className="text-xs text-black/45 font-medium mt-0.5">
            Tap a collection to add or remove this item
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                     bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                     active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {isLoading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-black/5 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && (!outfits || outfits.length === 0) && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
            <p className="text-sm font-semibold text-black/40">No collections yet.</p>
            <p className="text-xs text-black/30 mt-1">
              Save a lineup first from the Generate tab.
            </p>
          </div>
        )}

        {outfits?.map((outfit) => {
          const isIn = (outfit.items ?? []).some((i) => i.id === item.id);
          return (
            <button
              key={outfit.id}
              onClick={() => handleToggle(outfit)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 border-black
                         bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                         active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all text-left"
              style={{ background: isIn ? "#B8E0F5" : "#fff" }}
            >
              <ThreeThumbs outfit={outfit} />
              <span className="flex-1 font-display font-bold text-sm uppercase tracking-tight truncate">
                {outfit.name}
              </span>
              <div
                className="w-6 h-6 rounded-full border-2 border-black flex-shrink-0 flex items-center justify-center"
                style={{ background: isIn ? "#1a0800" : "transparent" }}
              >
                {isIn && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
