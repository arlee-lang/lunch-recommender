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
        "flex min-w-[84px] min-h-[44px] flex-col items-start gap-0.5 rounded-sm px-3.5 py-2 text-left " +
        (selected
          ? "bg-[#f68d1f] text-white border-t border-[#ffcf9b] border-b-[3px] border-b-[#b5610a] border-x border-x-[#d97516] shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]"
          : "bg-[#dedede] text-[#21242e] border-t border-white border-b-2 border-b-[#3d4f97] border-x border-x-[#b7bcd6]")
      }
    >
      <span className="text-[13px] font-bold">{label}</span>
      <span className="font-[family-name:var(--font-silkscreen)] text-[9px] font-normal opacity-80">
        {sub}
      </span>
    </button>
  );
}
