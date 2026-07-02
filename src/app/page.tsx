"use client";

import { useState } from "react";
import Image from "next/image";
import { CategorySelection, Restaurant, WalkMinutes } from "@/lib/types";
import { SelectChip } from "@/components/select-chip";
import { ResultCard } from "@/components/result-card";

type Phase = "idle" | "loading" | "result" | "empty" | "error";

const DISTANCE_OPTIONS: { value: WalkMinutes; sub: string }[] = [
  { value: 5, sub: "~350m" },
  { value: 10, sub: "350~700m" },
  { value: 15, sub: "700m~1km" },
];

const CATEGORY_OPTIONS: { value: CategorySelection; sub: string }[] = [
  { value: "한식", sub: "밥·면·고기" },
  { value: "중식", sub: "짜장·짬뽕" },
  { value: "양식", sub: "파스타·스테이크" },
  { value: "기타", sub: "일식·분식·카페" },
  { value: "아무거나", sub: "전체 다 보기" },
];

function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 5000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      },
      () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(null);
        }
      },
      { timeout: 4500, maximumAge: 60000 }
    );
  });
}

export default function Home() {
  const [walkMinutes, setWalkMinutes] = useState<WalkMinutes | null>(null);
  const [category, setCategory] = useState<CategorySelection | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [usedFallback, setUsedFallback] = useState(false);
  const [lastIds, setLastIds] = useState<string[]>([]);

  const canRecommend = walkMinutes !== null && category !== null && phase !== "loading";

  async function handleRecommend() {
    if (walkMinutes === null || category === null) return;
    setPhase("loading");

    const coords = await getCurrentPosition();

    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(coords ?? {}),
          walkMinutes,
          category,
          excludeIds: lastIds,
        }),
      });
      if (!res.ok) throw new Error("request failed");

      const data = await res.json();
      if (data.empty) {
        setPhase("empty");
        setRestaurants([]);
        return;
      }

      setRestaurants(data.restaurants);
      setUsedFallback(data.usedFallback);
      setLastIds(data.restaurants.map((r: Restaurant) => r.id));
      setPhase("result");
    } catch {
      setPhase("error");
    }
  }

  return (
    <div className="min-h-screen bg-[#fffaf0] px-4 pb-16 pt-6">
      <div className="mx-auto max-w-[1000px]">
        {/* top nav */}
        <div className="flex items-center py-2">
          <span className="text-[18px] font-semibold tracking-[-0.3px] text-[#0a0a0a]">점심추천</span>
        </div>

        {/* hero */}
        <div className="flex flex-wrap items-center gap-8 py-10">
          <div className="min-w-[280px] flex-1">
            <h1 className="text-[40px] font-medium leading-[1.1] tracking-[-1px] text-[#0a0a0a] sm:text-[56px] sm:tracking-[-2px]">
              오늘 뭐 먹지?
            </h1>
            <p className="mt-3 max-w-[440px] text-[16px] leading-relaxed text-[#3a3a3a]">
              거리랑 메뉴만 고르면, 내 위치(또는 사무실) 근처 식당 3곳을 바로 뽑아드려요. 논의 끝,
              클릭 두 번.
            </p>
          </div>
          <div className="flex-none overflow-hidden rounded-[24px] bg-[#faf5e8] p-4">
            <Image
              src="/food-illustrations.jpg"
              alt="맛있는 음식 일러스트"
              width={224}
              height={224}
              className="rounded-[16px]"
              priority
            />
          </div>
        </div>

        {/* body split */}
        <div className="flex flex-wrap items-start gap-4">
          {/* content column */}
          <div className="flex min-w-[300px] flex-1 flex-col gap-4">
            {/* filter card */}
            <div className="rounded-[16px] border border-[#e5e5e5] bg-white p-6">
              <div className="text-[12px] font-semibold uppercase tracking-[1.5px] text-[#6a6a6a]">
                Step 1 · 조건 선택
              </div>

              <div className="mt-4 text-[14px] font-semibold text-[#0a0a0a]">🚶 걸을 수 있는 거리</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {DISTANCE_OPTIONS.map((opt) => (
                  <SelectChip
                    key={opt.value}
                    label={`도보 ${opt.value}분`}
                    sub={opt.sub}
                    selected={walkMinutes === opt.value}
                    onClick={() => setWalkMinutes(opt.value)}
                  />
                ))}
              </div>

              <div className="my-5 h-px bg-[#e5e5e5]" />

              <div className="text-[14px] font-semibold text-[#0a0a0a]">🍽 먹고 싶은 메뉴</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectChip
                    key={opt.value}
                    label={opt.value}
                    sub={opt.sub}
                    selected={category === opt.value}
                    onClick={() => setCategory(opt.value)}
                  />
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!canRecommend}
                  onClick={handleRecommend}
                  className={
                    "inline-flex min-h-[44px] items-center gap-1.5 rounded-[12px] px-5 text-[14px] font-semibold " +
                    (canRecommend
                      ? "cursor-pointer bg-[#0a0a0a] text-white hover:bg-[#1f1f1f]"
                      : "cursor-not-allowed bg-[#e5e5e5] text-[#9a9a9a]")
                  }
                >
                  <span>
                    {phase === "loading"
                      ? "추천 중…"
                      : phase === "result"
                        ? "조건으로 다시 추천"
                        : "추천받기"}
                  </span>
                  <span className="text-[15px]">→</span>
                </button>
                {!canRecommend && phase !== "loading" && (
                  <span className="text-[13px] text-[#9a9a9a]">거리와 메뉴를 모두 골라주세요</span>
                )}
              </div>
            </div>

            {/* results card */}
            <div className="rounded-[16px] border border-[#e5e5e5] bg-white p-6">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold uppercase tracking-[1.5px] text-[#6a6a6a]">
                  Step 2 · 추천 결과 3곳
                </span>
                {phase === "result" && (
                  <button
                    type="button"
                    onClick={handleRecommend}
                    className="min-h-[36px] rounded-[10px] border border-[#e5e5e5] bg-white px-3 text-[13px] font-semibold text-[#0a0a0a] hover:bg-[#faf5e8]"
                  >
                    🎲 다시 추천
                  </button>
                )}
              </div>

              <div className="mt-4">
                {phase === "idle" && (
                  <div className="py-8 text-center">
                    <div className="text-[32px] leading-none">🍜🍚🍝</div>
                    <div className="mt-3 text-[14px] text-[#6a6a6a]">
                      위에서 <b className="text-[#0a0a0a]">거리</b>와 <b className="text-[#0a0a0a]">메뉴</b>를
                      고르고 <b className="text-[#0a0a0a]">추천받기</b>를 누르세요.
                    </div>
                  </div>
                )}

                {phase === "loading" && (
                  <div className="py-9 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#e5e5e5] border-t-[#0a0a0a]" />
                    <div className="mt-4 text-[14px] font-medium text-[#3a3a3a]">추천 중...</div>
                  </div>
                )}

                {phase === "empty" && (
                  <div className="py-8 text-center">
                    <div className="text-[28px]">🤔</div>
                    <div className="mt-3 text-[14px] font-semibold text-[#0a0a0a]">
                      이 조건에 맞는 식당이 없어요.
                    </div>
                    <div className="mt-1 text-[13px] text-[#6a6a6a]">거리를 늘려서 다시 시도해보세요.</div>
                  </div>
                )}

                {phase === "error" && (
                  <div className="py-8 text-center">
                    <div className="inline-block rounded-full bg-[#ef4444]/10 px-3 py-1 text-[12px] font-semibold text-[#ef4444]">
                      ERROR
                    </div>
                    <div className="mt-3 text-[14px] font-semibold text-[#0a0a0a]">
                      지도 정보를 불러오지 못했어요.
                    </div>
                    <div className="mt-1 text-[13px] text-[#6a6a6a]">잠시 후 다시 시도해주세요.</div>
                    <button
                      type="button"
                      onClick={handleRecommend}
                      className="mt-4 min-h-[40px] rounded-[12px] bg-[#0a0a0a] px-4 text-[13px] font-semibold text-white"
                    >
                      ↻ 다시 시도
                    </button>
                  </div>
                )}

                {phase === "result" && (
                  <>
                    {usedFallback && (
                      <div className="mb-3 flex items-center gap-2 rounded-[12px] bg-[#faf5e8] px-3 py-2.5">
                        <span className="text-[15px]">📍</span>
                        <span className="text-[13px] leading-snug text-[#3a3a3a]">
                          현재 위치 대신 사무실(장충단로 166) 기준으로 추천했어요.
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col gap-3">
                      {restaurants.map((r, i) => (
                        <ResultCard key={r.id} restaurant={r} rank={i + 1} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* right rail */}
          <div className="w-full flex-none sm:w-72">
            <div className="flex flex-col gap-4">
              <div className="rounded-[24px] bg-[#b8a4ed] p-6">
                <div className="text-[16px] font-semibold text-[#0a0a0a]">? 어떻게 추천하나요</div>
                <div className="mt-2 text-[13px] leading-relaxed text-[#0a0a0a]/80">
                  내 <b>현재 위치</b>(또는 사무실)를 기준으로 반경 안의 식당을 찾아 <b>랜덤 3곳</b>을
                  뽑아요. 마음에 안 들면 <b>다시 추천</b>을 누르세요 — 방금 나온 곳은 빼고 다시
                  뽑아드려요.
                </div>
              </div>

              <div className="rounded-[24px] bg-[#ffb084] p-6">
                <div className="text-[12px] font-semibold uppercase tracking-[1.5px] text-[#0a0a0a]/60">
                  기준 위치
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[16px]">{phase === "result" ? (usedFallback ? "🏢" : "🛰") : "📍"}</span>
                  <span className="text-[15px] font-semibold text-[#0a0a0a]">
                    {phase === "result" ? (usedFallback ? "사무실 (폴백)" : "현재 위치") : "미확인"}
                  </span>
                </div>
                <div className="mt-1 text-[12px] leading-snug text-[#0a0a0a]/70">
                  {phase === "result"
                    ? usedFallback
                      ? "장충단로 166 종이나라빌딩 4F"
                      : "GPS 좌표 기준 반경 검색"
                    : "추천받기를 누르면 확인해요"}
                </div>
              </div>

              <div className="rounded-[24px] bg-[#e8b94a] p-6">
                <div className="text-[18px] font-medium leading-tight tracking-[-0.5px] text-[#0a0a0a]">
                  장충동 족발골목
                </div>
                <div className="mt-2 text-[13px] leading-relaxed text-[#0a0a0a]/70">
                  사무실에서 도보 3분. 애매하면 여기부터.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* footer */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-[#faf5e8] px-6 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[#f5f0e0] px-3 py-1 text-[12px] font-medium text-[#3a3a3a]">
              위치정보 · 서버 미저장
            </span>
            <span className="text-[12px] text-[#9a9a9a]">데이터 출처: 카카오맵 로컬 API</span>
          </div>
          <span className="text-[12px] text-[#9a9a9a]">© 2026 동대입구 점심추천기 · 종이나라빌딩 4F</span>
        </div>
      </div>
    </div>
  );
}
