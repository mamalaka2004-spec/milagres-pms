import { type LucideIcon } from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 lg:p-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
        <Icon size={28} className="text-brand-500" strokeWidth={1.5} />
      </div>
      <h3 className="font-heading text-xl text-gray-900 mb-2">{title}</h3>
      <p className="font-body text-sm text-gray-500 max-w-sm mx-auto mb-6">{description}</p>
      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
