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

export function ResultCard({ restaurant, rank, priceFilterActive }: ResultCardProps) {
  const priceText = formatPrice(restaurant.priceMin, restaurant.priceMax);

  return (
    <div className="flex items-stretch gap-3 rounded-[16px] border border-[#e5e5e5] bg-white px-4 py-4">
      <div className="flex w-9 flex-none items-start justify-center pt-0.5">
        <span className="text-[13px] font-semibold text-[#9a9a9a]">{String(rank).padStart(2, "0")}</span>
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
        </div>
      </div>
    </div>
  );
}
