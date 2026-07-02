"use client";

interface SelectChipProps {
  label: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
}

export function SelectChip({ label, sub, selected, onClick }: SelectChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex min-w-[92px] min-h-[52px] flex-col items-start justify-center gap-0.5 rounded-full px-4 py-2 text-left transition-colors " +
        (selected
          ? "bg-[#0a0a0a] text-white"
          : "border border-[#e5e5e5] bg-transparent text-[#3a3a3a] hover:bg-[#faf5e8]")
      }
    >
      <span className="text-[14px] font-semibold leading-tight">{label}</span>
      <span className={"text-[11px] leading-tight " + (selected ? "text-white/70" : "text-[#9a9a9a]")}>
        {sub}
      </span>
    </button>
  );
}
