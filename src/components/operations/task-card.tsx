"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, Play, SkipForward, Clock } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { TASK_TYPE_LABELS } from "@/lib/validations/task";
import { TASK_STATUSES, PRIORITIES } from "@/lib/utils/constants";
import { formatDate, formatTime, getInitials } from "@/lib/utils/format";
import type { TaskWithJoins, TaskStatus } from "@/lib/db/queries/tasks";

interface TaskCardProps {
  task: TaskWithJoins;
}

export function TaskCard({ task }: TaskCardProps) {
  const router = useRouter();
  const [pending, setPending] = useState<TaskStatus | null>(null);
  const [error, setError] = useState("");

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const isOverdue =
    task.status !== "completed" &&
    task.status !== "skipped" &&
    task.due_date !== null &&
    task.due_date < todayStr;

  const statusCfg = TASK_STATUSES[task.status];
  const priorityCfg = PRIORITIES[task.priority];

  const transition = async (next: TaskStatus) => {
    setPending(next);
    setError("");
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setPending(null);
    }
  };

  return (
    <div
      className={cn(
        "bg-white rounded-xl border p-4 space-y-2 transition-colors",
        isOverdue ? "border-red-200" : "border-gray-200",
        task.status === "completed" && "opacity-60"
      )}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{ background: priorityCfg.bgColor, color: priorityCfg.color }}
            >
              {priorityCfg.label}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
              {TASK_TYPE_LABELS[task.type]}
            </span>
            {isOverdue && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-red-600">
                <Clock size={10} /> Overdue
              </span>
            )}
          </div>
          <div className="font-semibold text-sm text-gray-900 mt-1">
            {task.property ? (
              <Link
                href={`/properties/${task.property.id}`}
                className="hover:text-brand-600"
              >
                {task.property.name}
              </Link>
            ) : (
              "—"
            )}
          </div>
          {task.reservation && (
            <Link
              href={`/reservations/${task.reservation.id}`}
              className="text-xs text-gray-500 hover:text-brand-600 inline-flex items-center gap-1"
            >
              <span className="font-mono">{task.reservation.booking_code}</span>
              {task.reservation.guest && <span>· {task.reservation.guest.full_name}</span>}
            </Link>
          )}
        </div>
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
          style={{ background: statusCfg.bgColor, color: statusCfg.color }}
        >
          {statusCfg.label}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-gray-600 pt-1 border-t border-gray-50">
        <div className="flex items-center gap-2">
          <Clock size={12} className="text-gray-400" />
          <span>
            {task.due_date ? formatDate(task.due_date) : "No due date"}
            {task.due_time && ` · ${formatTime(task.due_time)}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {task.assignee ? (
            <span
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-gray-100 text-[11px]"
              title={task.assignee.full_name}
            >
              <span className="w-5 h-5 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-[9px] font-bold">
                {getInitials(task.assignee.full_name)}
              </span>
              <span className="hidden sm:inline">{task.assignee.full_name}</span>
            </span>
          ) : (
            <span className="text-[11px] text-gray-400 italic">Unassigned</span>
          )}
        </div>
      </div>

      {task.notes && (
        <div className="text-xs text-gray-500 pt-1 italic">{task.notes}</div>
      )}

      {task.status !== "completed" && task.status !== "skipped" && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-50">
          {task.status === "pending" && (
            <button
              type="button"
              onClick={() => transition("in_progress")}
              disabled={pending !== null}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 disabled:opacity-50"
            >
              {pending === "in_progress" ? <Loader2 size={11} className="animate-spin" /> : <Play size={11} />}
              Start
            </button>
          )}
          <button
            type="button"
            onClick={() => transition("completed")}
            disabled={pending !== null}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-green-500 hover:bg-green-600 text-white disabled:opacity-50"
          >
            {pending === "completed" ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
            Complete
          </button>
          <button
            type="button"
            onClick={() => transition("skipped")}
            disabled={pending !== null}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
          >
            {pending === "skipped" ? <Loader2 size={11} className="animate-spin" /> : <SkipForward size={11} />}
            Skip
          </button>
        </div>
      )}

      {error && (
        <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
          {error}
        </div>
      )}
    </div>
  );
}
