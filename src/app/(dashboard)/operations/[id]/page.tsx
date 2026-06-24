import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getTaskDetail } from "@/lib/db/queries/tasks";
import { TaskWorkspace } from "@/components/operations/task-workspace";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: PageProps) {
  const user = await requireAuth();
  const { id } = await params;

  let task;
  try {
    task = await getTaskDetail(id);
  } catch {
    notFound();
  }
  if (!task || task.company_id !== user.company_id) notFound();

  return <TaskWorkspace task={task} />;
}
