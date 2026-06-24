import { ClipboardList, AlertOctagon, CheckCircle2, ChevronRight } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { listTasks } from "@/lib/db/queries/tasks";
import { getProperties } from "@/lib/db/queries/properties";
import { TaskCard } from "@/components/operations/task-card";
import { NewTaskButton } from "@/components/operations/new-task-button";

export const dynamic = "force-dynamic";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function plusDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function OperationsPage() {
  const user = await requireAuth();
  const today = todayISO();
  const completedFrom = plusDays(today, -14);

  // Staff (camareiras/prestadores) see only the tasks assigned to them.
  const mine = user.role === "staff" ? { assigned_to: user.id } : {};

  const [allActive, completed, overdue, propsRaw] = await Promise.all([
    listTasks(user.company_id, { status: "all", ...mine }),
    listTasks(user.company_id, { status: "completed", from: completedFrom, ...mine }),
    listTasks(user.company_id, { overdue_before: today, ...mine }),
    getProperties(user.company_id, { status: "active" }),
  ]);

  const properties = (propsRaw as unknown as Array<{ id: string; name: string; code: string }>).map(
    (p) => ({ id: p.id, name: p.name, code: p.code })
  );

  // Buckets
  const todayTasks = allActive.filter(
    (t) => t.due_date === today && t.status !== "completed" && t.status !== "skipped"
  );
  const upcomingTasks = allActive.filter(
    (t) =>
      t.due_date !== null &&
      t.due_date > today &&
      t.status !== "completed" &&
      t.status !== "skipped"
  );
  const noDueTasks = allActive.filter(
    (t) => t.due_date === null && t.status !== "completed" && t.status !== "skipped"
  );

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Operações</h1>
        <NewTaskButton properties={properties} />
      </div>

      {/* Stat bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat
          icon={AlertOctagon}
          label="Atrasadas"
          value={String(overdue.length)}
          tone={overdue.length > 0 ? "danger" : undefined}
        />
        <Stat
          icon={ChevronRight}
          label="Hoje"
          value={String(todayTasks.length)}
          tone={todayTasks.length > 0 ? "active" : undefined}
        />
        <Stat icon={ClipboardList} label="Próximas" value={String(upcomingTasks.length)} />
        <Stat
          icon={CheckCircle2}
          label="Concluídas (14d)"
          value={String(completed.length)}
          tone="positive"
        />
      </div>

      {/* Sections */}
      {overdue.length > 0 && (
        <Section title="Atrasadas" tone="danger">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {overdue.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Hoje">
        {todayTasks.length === 0 ? (
          <Empty message="Nenhuma tarefa agendada para hoje." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {todayTasks.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Próximas">
        {upcomingTasks.length === 0 ? (
          <Empty message="Nada agendado à frente." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {upcomingTasks.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        )}
      </Section>

      {noDueTasks.length > 0 && (
        <Section title="Sem prazo">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {noDueTasks.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Concluídas recentemente">
        {completed.length === 0 ? (
          <Empty message="Nenhuma tarefa concluída recentemente." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {completed.slice(0, 9).map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone?: "danger" | "positive" | "active";
}) {
  const toneClass =
    tone === "danger"
      ? "text-red-700"
      : tone === "positive"
      ? "text-green-700"
      : tone === "active"
      ? "text-brand-700"
      : "text-gray-900";

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <div className="flex items-center gap-2 text-gray-400 mb-1">
        <Icon size={14} aria-hidden="true" />
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-xl lg:text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

function Section({
  title,
  children,
  tone,
}: {
  title: string;
  children: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <section>
      <h2
        className={`text-xs font-bold uppercase tracking-wider mb-2 ${
          tone === "danger" ? "text-red-700" : "text-gray-500"
        }`}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-6 text-center text-sm text-gray-400">
      {message}
    </div>
  );
}
