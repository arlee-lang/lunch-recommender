"use client";

import { useState } from "react";
import { CategoryGroup, Restaurant, WalkMinutes } from "@/lib/types";
import { SelectChip } from "@/components/select-chip";
import { ResultCard } from "@/components/result-card";

type Phase = "idle" | "loading" | "result" | "empty" | "error";

const DISTANCE_OPTIONS: { value: WalkMinutes; sub: string }[] = [
  { value: 5, sub: "~350m" },
  { value: 10, sub: "~700m" },
  { value: 15, sub: "~1000m" },
];

const CATEGORY_OPTIONS: { value: CategoryGroup; sub: string }[] = [
  { value: "한식", sub: "밥·면·고기" },
  { value: "중식", sub: "짜장·짬뽕" },
  { value: "양식", sub: "파스타·스테이크" },
  { value: "기타", sub: "일식·분식·카페" },
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
  const [category, setCategory] = useState<CategoryGroup | null>(null);
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
    <div
      className="min-h-screen box-border px-3 pb-10 pt-[18px]"
      style={{
        background: "radial-gradient(140% 120% at 50% -10%, #5a628f 0%, #3d4f97 45%, #2c3363 100%)",
      }}
    >
      <div className="mx-auto max-w-[900px]">
        {/* mascot bubble */}
        <div className="mb-2 ml-1 flex items-end gap-2.5">
          <div
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 border-white text-2xl shadow-[0_2px_0_#21242e]"
            style={{ background: "linear-gradient(#f2c94c, #e48600)" }}
          >
            🍚
          </div>
          <div className="relative rounded-[10px] bg-white px-3 py-2 shadow-[0_2px_0_#21242e]">
            <span className="font-[family-name:var(--font-silkscreen)] text-[11px] font-bold tracking-wide text-[#21242e]">
              오늘도 든든하게! 점심 골라줄게요 →
            </span>
            <span className="absolute -left-[7px] bottom-[9px] h-0 w-0 border-[6px] border-transparent border-r-white" />
          </div>
        </div>

        {/* primary nav */}
        <div
          className="flex flex-wrap items-center gap-2.5 border-t border-[#4a4f6b] border-b-2 border-b-black px-2 py-1.5"
          style={{
            backgroundColor: "#21242e",
            backgroundImage: "radial-gradient(rgba(255,255,255,.07) 1px, transparent 1px)",
            backgroundSize: "4px 4px",
          }}
        >
          <div className="flex flex-none items-center rounded-full bg-white px-3.5 py-0.5 shadow-[inset_0_-2px_0_rgba(0,0,0,0.15)]">
            <span className="font-[family-name:var(--font-archivo-black)] text-[15px] italic tracking-tight text-[#e60012]">
              점심추천
            </span>
          </div>
          <div className="flex min-w-[180px] flex-1 items-center gap-3.5">
            <span className="text-[13px] font-bold uppercase tracking-wide text-[#e48600]">추천</span>
            <span className="text-[13px] font-bold uppercase tracking-wide text-[#8a8fb0]">즐겨찾기</span>
            <span className="text-[13px] font-bold uppercase tracking-wide text-[#8a8fb0]">지도</span>
            <span className="text-[13px] font-bold uppercase tracking-wide text-[#8a8fb0]">도움말</span>
          </div>
          <div className="flex flex-none gap-1.5">
            <span className="rounded-sm border-t border-[#f7d488] border-b-2 border-b-[#b5820f] bg-[#ecab37] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#21242e]">
              동대입구역
            </span>
            <span className="rounded-sm border-t border-[#f7d488] border-b-2 border-b-[#b5820f] bg-[#ecab37] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#21242e]">
              랜덤
            </span>
          </div>
        </div>

        {/* subnav */}
        <div className="flex flex-wrap items-center gap-0.5 border-b border-[#3d4f97] bg-[#9fbee7] px-2.5 py-1">
          {["동대입구역", "장충동", "필동", "회사근처", "즐겨찾기", "도움말"].map((s) => (
            <span
              key={s}
              className="border-r border-[#6d84b8] px-2 text-[11px] font-bold uppercase tracking-wide text-[#21242e]"
            >
              {s}
            </span>
          ))}
        </div>

        {/* hero */}
        <div
          className="relative mt-[3px] overflow-hidden border-t-2 border-white/35 px-[22px] py-[26px]"
          style={{
            background: "linear-gradient(160deg, #c1c1f0 0%, #acace7 55%, #9a8fd8 100%)",
            clipPath:
              "polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 18px 100%, 0 calc(100% - 18px))",
          }}
        >
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div>
              <div
                className="font-[family-name:var(--font-archivo-black)] text-[46px] italic leading-[0.95] tracking-tight text-white"
                style={{
                  textShadow: "3px 3px 0 #21242e",
                  WebkitTextStroke: "2px #21242e",
                  paintOrder: "stroke fill",
                }}
              >
                오늘 뭐 먹지?
              </div>
              <div className="mt-2.5 max-w-[440px] text-[15px] font-bold leading-snug text-[#21242e]">
                거리랑 메뉴만 고르면, 내 위치(또는 사무실) 근처 식당 3곳을 바로 뽑아드려요. 논의 끝,
                클릭 두 번.
              </div>
            </div>
            <div className="flex h-[54px] w-[54px] flex-none items-center justify-center rounded-full border-t-2 border-[#ffcf9b] border-b-[3px] border-b-[#b5610a] bg-[#f68d1f] shadow-[0_3px_0_rgba(0,0,0,0.25)]">
              <span className="text-2xl font-black leading-none text-white">›</span>
            </div>
          </div>
        </div>

        {/* body split */}
        <div className="mt-3.5 flex flex-wrap items-start gap-3.5">
          {/* left rail (decorative) */}
          <div className="flex flex-none flex-col gap-[3px]">
            {["가까운순", "인기", "한식", "전체"].map((t) => (
              <div
                key={t}
                className="border-l border-[#4a4f6b] border-r-2 border-r-black px-1 py-2 text-[9px] font-bold uppercase tracking-widest text-[#9fbee7]"
                style={{
                  backgroundColor: "#21242e",
                  backgroundImage: "radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px)",
                  backgroundSize: "4px 4px",
                  writingMode: "vertical-rl",
                  textOrientation: "mixed",
                }}
              >
                {t}
              </div>
            ))}
          </div>

          {/* content column */}
          <div className="flex min-w-[300px] flex-1 flex-col gap-3.5">
            {/* filter plate */}
            <div className="overflow-hidden rounded-md border-t border-[#c3d3f0] border-b-2 border-b-[#3d4f97] bg-[#8ba1d4]">
              <div className="flex items-center gap-1.5 border-b border-[#3d4f97] bg-[#7a8aba] px-2.5 py-1.5">
                <span className="flex gap-0.5">
                  <span className="block h-[5px] w-[5px] bg-[#21242e]" />
                  <span className="block h-[5px] w-[5px] bg-[#21242e]" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#21242e]">
                  STEP 1 · 조건 선택
                </span>
              </div>

              <div className="px-3 py-3.5">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#21242e]">
                  🚶 걸을 수 있는 거리
                </div>
                <div className="flex flex-wrap gap-1.5">
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

                <div className="my-3.5 h-0 border-t border-dotted border-[#60619c]" />

                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[#21242e]">
                  🍽 먹고 싶은 메뉴
                </div>
                <div className="flex flex-wrap gap-1.5">
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

                <div className="mt-4 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={!canRecommend}
                    onClick={handleRecommend}
                    className={
                      "inline-flex min-h-[44px] items-center gap-1.5 rounded-sm px-[22px] py-2.5 text-[13px] font-bold uppercase tracking-wide " +
                      (canRecommend
                        ? "cursor-pointer border-t border-[#ffcf9b] border-b-[3px] border-b-[#b5610a] bg-[#f68d1f] text-white"
                        : "cursor-not-allowed border-t border-[#b3b8cf] border-b-[3px] border-b-[#6d7295] bg-[#9aa0bf] text-[#e6e8f2]")
                    }
                  >
                    <span>
                      {phase === "loading"
                        ? "추천 중…"
                        : phase === "result"
                          ? "조건으로 다시 추천"
                          : "추천받기"}
                    </span>
                    <span className="text-[15px] font-black">›</span>
                  </button>
                  {!canRecommend && phase !== "loading" && (
                    <span className="text-[11px] text-[#21242e]/70">거리와 메뉴를 모두 골라주세요</span>
                  )}
                </div>
              </div>
            </div>

            {/* results plate */}
            <div className="overflow-hidden rounded-md border-t border-white border-b-2 border-b-[#3d4f97] bg-[#dedede]">
              <div className="flex items-center justify-between gap-1.5 border-b border-[#3d4f97] bg-[#7a8aba] px-2.5 py-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#21242e]">
                  STEP 2 · 추천 결과 3곳
                </span>
                {phase === "result" && (
                  <button
                    type="button"
                    onClick={handleRecommend}
                    className="min-h-[28px] rounded-sm border-t border-[#f7d488] border-b-2 border-b-[#b5820f] bg-[#ecab37] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#21242e]"
                  >
                    🎲 다시 추천
                  </button>
                )}
              </div>

              <div className="p-3">
                {phase === "idle" && (
                  <div className="py-6 text-center">
                    <div className="text-[34px] leading-none">🍜🍚🍝</div>
                    <div className="mt-3 text-xs text-[#5a5f8c]">
                      위에서 <b>거리</b>와 <b>메뉴</b>를 고르고 <b>추천받기</b>를 누르세요.
                    </div>
                  </div>
                )}

                {phase === "loading" && (
                  <div className="py-7 text-center">
                    <div className="mx-auto h-[30px] w-[30px] animate-spin rounded-full border-4 border-[#b7c4dd] border-t-[#f68d1f]" />
                    <div className="mt-3.5 font-[family-name:var(--font-silkscreen)] text-xs tracking-wide text-[#21242e]">
                      추천 중<span className="animate-pulse">...</span>
                    </div>
                  </div>
                )}

                {phase === "empty" && (
                  <div className="py-6 text-center">
                    <div className="text-[30px]">🤔</div>
                    <div className="mt-2.5 text-[13px] font-bold text-[#21242e]">
                      이 조건에 맞는 식당이 없어요.
                    </div>
                    <div className="mt-1 text-xs text-[#5a5f8c]">거리를 늘려서 다시 시도해보세요.</div>
                  </div>
                )}

                {phase === "error" && (
                  <div className="py-6 text-center">
                    <div className="inline-block rounded-sm bg-[#e60012] px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white">
                      ERROR
                    </div>
                    <div className="mt-2.5 text-[13px] font-bold text-[#21242e]">
                      지도 정보를 불러오지 못했어요.
                    </div>
                    <div className="mt-1 text-xs text-[#5a5f8c]">잠시 후 다시 시도해주세요.</div>
                    <button
                      type="button"
                      onClick={handleRecommend}
                      className="mt-3 min-h-[40px] rounded-sm border-t border-[#ffcf9b] border-b-2 border-b-[#b5610a] bg-[#f68d1f] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white"
                    >
                      ↻ 다시 시도
                    </button>
                  </div>
                )}

                {phase === "result" && (
                  <>
                    {usedFallback && (
                      <div className="mb-2.5 flex items-center gap-2 rounded-[3px] border-l-4 border-l-[#ecab37] bg-white px-2.5 py-2">
                        <span className="text-[15px]">📍</span>
                        <span className="text-[11px] leading-snug text-[#21242e]">
                          현재 위치 대신 사무실(장충단로 166) 기준으로 추천했어요.
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
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
          <div className="w-full flex-none sm:w-60">
            <div className="flex flex-col gap-3">
              <div className="overflow-hidden rounded border-t border-white border-b-2 border-b-[#b7bcd6] bg-white">
                <div className="bg-[#ecab37] px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-[#21242e]">
                  ? 어떻게 추천하나요
                </div>
                <div className="p-2.5 text-[11.5px] leading-relaxed text-[#21242e]">
                  내 <b>현재 위치</b>(또는 사무실)를 기준으로 반경 안의 식당을 찾아 <b>랜덤 3곳</b>을
                  뽑아요. 마음에 안 들면 <b>다시 추천</b>을 누르세요 — 방금 나온 곳은 빼고 다시
                  뽑아드려요.
                </div>
              </div>

              <div className="rounded border-t border-[#e2edf7] border-b-2 border-b-[#3d4f97] bg-[#c0d5e6] p-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-[#3d4f97]">
                  기준 위치
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="text-sm">
                    {phase === "result" ? (usedFallback ? "🏢" : "🛰") : "📍"}
                  </span>
                  <span className="text-xs font-bold text-[#21242e]">
                    {phase === "result" ? (usedFallback ? "사무실 (폴백)" : "현재 위치") : "미확인"}
                  </span>
                </div>
                <div className="mt-1 text-[10px] leading-snug text-[#5a5f8c]">
                  {phase === "result"
                    ? usedFallback
                      ? "장충단로 166 종이나라빌딩 4F"
                      : "GPS 좌표 기준 반경 검색"
                    : "추천받기를 누르면 확인해요"}
                </div>
              </div>

              <div className="relative overflow-hidden rounded border-t border-[#d3d3f5] border-b-2 border-b-[#3d4f97] bg-[#acace7] p-3">
                <div
                  className="font-[family-name:var(--font-archivo-black)] text-[17px] italic leading-none text-white"
                  style={{
                    textShadow: "2px 2px 0 #6d5fb0",
                    WebkitTextStroke: "1px #6d5fb0",
                    paintOrder: "stroke fill",
                  }}
                >
                  장충동
                  <br />
                  족발골목
                </div>
                <div className="mt-1.5 text-[11px] leading-snug text-[#3d3560]">
                  사무실에서 도보 3분. 애매하면 여기부터.
                </div>
                <div
                  className="mt-2 flex h-[46px] items-center justify-center rounded"
                  style={{
                    background:
                      "repeating-linear-gradient(45deg, #9a9ae0, #9a9ae0 6px, #8f8fd8 6px, #8f8fd8 12px)",
                  }}
                >
                  <span className="font-[family-name:var(--font-silkscreen)] text-[9px] text-[#4a4478]">
                    [ 족발 사진 ]
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* footer */}
        <div
          className="mt-4 border-t border-[#4a4f6b] px-4 py-3.5"
          style={{
            backgroundColor: "#21242e",
            backgroundImage: "radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px)",
            backgroundSize: "4px 4px",
            clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-sm bg-[#ecab37] px-1.5 py-0.5 font-[family-name:var(--font-silkscreen)] text-[9px] font-bold tracking-wide text-[#21242e]">
                위치정보 · 서버 미저장
              </span>
              <span className="text-[10px] text-[#9fbee7]">데이터 출처: 카카오맵 로컬 API</span>
            </div>
            <span className="font-[family-name:var(--font-silkscreen)] text-[9px] tracking-wide text-[#6d84b8]">
              © 2026 동대입구 점심추천기 · 종이나라빌딩 4F
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
