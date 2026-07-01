"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Home, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatTime } from "@/lib/chat/utils";
import { TagChips } from "./tag-picker";
import type { DealCardData } from "@/types/funnel";

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function DealCard({
  deal,
  columnId,
  onOpen,
}: {
  deal: DealCardData;
  columnId: string;
  onOpen: (deal: DealCardData) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    data: { type: "deal", stageId: columnId },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      onClick={() => onOpen(deal)}
      className={cn(
        "group rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm transition-shadow duration-150 hover:shadow-md",
        deal.virtual && "border-dashed"
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 shrink-0 cursor-grab text-gray-300 hover:text-gray-400 active:cursor-grabbing touch-none"
          aria-label="Arrastar"
        >
          <GripVertical size={13} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-medium text-gray-900">{deal.title}</span>
            <span className="shrink-0 text-[10px] text-gray-400">{formatTime(deal.last_message_at)}</span>
          </div>

          {deal.property_name && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-gray-500">
              <Home size={11} className="shrink-0" /> {deal.property_name}
            </p>
          )}

          {deal.tags.length > 0 && (
            <div className="mt-1.5">
              <TagChips tags={deal.tags} size="sm" />
            </div>
          )}

          <div className="mt-1.5 flex items-center gap-1.5">
            {deal.value > 0 && (
              <span className="rounded bg-emerald-50 px-1 text-[10px] font-bold text-emerald-700">
                {formatBRL(deal.value)}
              </span>
            )}
            {deal.virtual && (
              <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                <MessageCircle size={9} /> conversa
              </span>
            )}
            {deal.unread_count > 0 && (
              <span className="ml-auto min-w-[18px] rounded-full bg-brand-600 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                {deal.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
