import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { getOwners } from "@/lib/db/queries/owners";
import { requirePageAuth } from "@/lib/auth";
import { EmptyState } from "@/components/shared/empty-state";

export const dynamic = "force-dynamic";

export default async function OwnersPage() {
  const user = await requirePageAuth();
  const owners = await getOwners(user.company_id);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Proprietários & Parceiros</h1>
        <Link
          href="/owners/new"
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40"
        >
          <Plus size={16} aria-hidden="true" /> Adicionar proprietário
        </Link>
      </div>

      {owners.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum proprietário ainda"
          description="Adicione proprietários ou parceiros de investimento para acompanhar participações e repasses."
          action={{ label: "+ Adicionar proprietário", href: "/owners/new" }}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">E-mail</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Telefone</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {owners.map((owner) => (
                <tr key={owner.id} className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-4 py-3">
                    <Link href={`/owners/${owner.id}`} className="font-semibold text-gray-900 hover:text-brand-600 transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/40">
                      {owner.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell">{owner.email || "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">{owner.phone || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${owner.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {owner.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
