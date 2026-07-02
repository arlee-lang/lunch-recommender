import { Restaurant } from "@/lib/types";

const BADGE_COLOR: Record<Restaurant["category_group"], string> = {
  한식: "#e60012",
  중식: "#e48600",
  양식: "#206479",
  기타: "#60619c",
};

interface ResultCardProps {
  restaurant: Restaurant;
  rank: number;
}

export function ResultCard({ restaurant, rank }: ResultCardProps) {
  return (
    <div className="flex items-stretch gap-2.5 rounded border-t border-white border-b-2 border-b-[#b7bcd6] bg-white px-2.5 py-2.5">
      <div className="flex w-10 flex-none flex-col items-center gap-1">
        <div className="font-[family-name:var(--font-archivo-black)] text-xl italic leading-none text-[#c0c4d8]">
          {String(rank).padStart(2, "0")}
        </div>
        <div className="flex h-5 w-[34px] items-center justify-center rounded-sm border border-[#21242e] bg-white">
          <span
            className="text-[11px] font-bold leading-none"
            style={{ color: BADGE_COLOR[restaurant.category_group] }}
          >
            {restaurant.category_group}
          </span>
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold leading-tight text-[#21242e]">{restaurant.name}</div>
        <div className="mt-0.5 text-[11px] leading-tight text-[#5a5f8c]">{restaurant.category_raw}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-sm bg-[#eef1f8] px-1.5 py-0.5 font-[family-name:var(--font-silkscreen)] text-[10px] text-[#21242e]">
            🚶 도보 {restaurant.walk_minutes}분
          </span>
          <span className="font-[family-name:var(--font-silkscreen)] text-[10px] text-[#5a5f8c]">
            {restaurant.distance_m}m
          </span>
          {restaurant.lunchHoursStatus === "unknown" && (
            <span className="inline-flex items-center gap-1 rounded-sm bg-[#fff4de] px-1.5 py-0.5 text-[10px] font-bold text-[#a06a00]">
              ⏰ 영업시간 미확인
            </span>
          )}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          <a
            href={restaurant.kakao_map_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[24px] items-center rounded-sm border-t border-[#fff48a] border-b-2 border-b-[#b5a800] bg-[#f7e600] px-2 text-[10px] font-bold uppercase tracking-wide text-[#21242e] no-underline"
          >
            카카오맵 ↗
          </a>
          <a
            href={restaurant.naver_map_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[24px] items-center rounded-sm border-t border-[#6cf0a5] border-b-2 border-b-[#018f40] bg-[#03c75a] px-2 text-[10px] font-bold uppercase tracking-wide text-white no-underline"
          >
            네이버맵 ↗
          </a>
        </div>
      </div>
      <a
        href={restaurant.kakao_map_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-5 flex-none items-center justify-center self-center rounded-sm border-t border-[#ffcf9b] border-b-2 border-b-[#b5610a] bg-[#f68d1f] text-white no-underline"
      >
        <span className="text-[13px] font-black leading-none">›</span>
      </a>
    </div>
  );
}
