import { useState } from "react";
import { Restaurant } from "@/lib/types";

const CATEGORY_TEXT_COLOR: Record<Restaurant["category_group"], string> = {
  한식: "#ff6b5a",
  중식: "#c98a1f",
  양식: "#1a3a3a",
  일식: "#b8425e",
  분식: "#e2483d",
  카페: "#8a5a3a",
  채식: "#3f8a5f",
  기타: "#7a63c9",
};

// No per-restaurant photo source exists (Kakao's API returns none; Google
// Places' photo would be a separate billable Enterprise-tier SKU) — a
// category glyph on a matching tint stands in as each card's "image".
const CATEGORY_EMOJI: Record<Restaurant["category_group"], string> = {
  한식: "🍚",
  중식: "🥟",
  양식: "🍝",
  일식: "🍣",
  분식: "🍢",
  카페: "☕",
  채식: "🌱",
  기타: "🍽",
};

const CATEGORY_TINT_BG: Record<Restaurant["category_group"], string> = {
  한식: "#ffe8e4",
  중식: "#fbeed2",
  양식: "#e7ecec",
  일식: "#fbe3ea",
  분식: "#fde0dc",
  카페: "#f1e4d8",
  채식: "#e1f0e6",
  기타: "#ebe6f7",
};

interface ResultCardProps {
  restaurant: Restaurant;
  rank: number;
  priceFilterActive?: boolean;
}

function formatPrice(min?: number, max?: number): string | null {
  if (min === undefined || max === undefined) return null;
  const fmt = (n: number) => n.toLocaleString("ko-KR");
  return min === max ? `${fmt(min)}원` : `${fmt(min)}~${fmt(max)}원`;
}

function formatRating(rating?: number, count?: number): string | null {
  if (rating === undefined) return null;
  return count !== undefined ? `${rating.toFixed(1)} (${count.toLocaleString("ko-KR")})` : rating.toFixed(1);
}

export function ResultCard({ restaurant, rank, priceFilterActive }: ResultCardProps) {
  const priceText = formatPrice(restaurant.priceMin, restaurant.priceMax);
  const ratingText = formatRating(restaurant.rating, restaurant.userRatingCount);
  const [justCopied, setJustCopied] = useState(false);

  async function handleShare() {
    const shareData = {
      title: restaurant.name,
      text: `오늘 뭐먹지????에서 추천받은 식당: ${restaurant.name}`,
      url: restaurant.kakao_map_url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled the share sheet — not an error
      }
      return;
    }

    await navigator.clipboard.writeText(`${shareData.text}\n${shareData.url}`);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 1500);
  }

  return (
    <div className="flex items-stretch gap-3 rounded-[16px] border border-[#e5e5e5] bg-white px-4 py-4">
      <div className="relative h-14 w-14 flex-none">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-[14px] text-[28px]"
          style={{ background: CATEGORY_TINT_BG[restaurant.category_group] }}
        >
          {CATEGORY_EMOJI[restaurant.category_group]}
        </div>
        <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-[#9a9a9a] shadow-[0_1px_2px_rgba(10,10,10,0.15)]">
          {rank}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[16px] font-semibold leading-tight text-[#0a0a0a]">{restaurant.name}</span>
          <span
            className="rounded-full bg-[#f5f0e0] px-2.5 py-0.5 text-[12px] font-medium"
            style={{ color: CATEGORY_TEXT_COLOR[restaurant.category_group] }}
          >
            {restaurant.category_group}
          </span>
        </div>
        <div className="mt-1 text-[13px] leading-snug text-[#6a6a6a]">{restaurant.category_raw}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {ratingText && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4de] px-2.5 py-1 text-[12px] font-medium text-[#a06a00]">
              ⭐ {ratingText}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full bg-[#faf5e8] px-2.5 py-1 text-[12px] font-medium text-[#3a3a3a]">
            🚶 도보 {restaurant.walk_minutes}분 · {restaurant.distance_m}m
          </span>
          {restaurant.lunchHoursStatus === "unknown" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4de] px-2.5 py-1 text-[12px] font-medium text-[#a06a00]">
              ⏰ 운영시간 확인필요
            </span>
          )}
          {priceText && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#f5f0e0] px-2.5 py-1 text-[12px] font-medium text-[#3a3a3a]">
              💰 {priceText}
            </span>
          )}
          {!priceText && priceFilterActive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4de] px-2.5 py-1 text-[12px] font-medium text-[#a06a00]">
              💰 가격 미확인
            </span>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <a
            href={restaurant.kakao_map_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[36px] items-center rounded-[12px] bg-[#f7e600] px-4 text-[13px] font-semibold text-[#0a0a0a] no-underline"
          >
            카카오맵에서 보기 ↗
          </a>
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-[12px] border border-[#e5e5e5] bg-white px-4 text-[13px] font-semibold text-[#0a0a0a] hover:bg-[#faf5e8]"
          >
            {justCopied ? "✓ 링크 복사됨" : "↗ 공유하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
