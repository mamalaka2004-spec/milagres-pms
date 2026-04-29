import Link from "next/link";
import { CheckCircle2, MessageCircle, ArrowLeft } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/public/site-header";

const WHATSAPP_URL = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5582999999999"}`;

interface PageProps {
  searchParams: Promise<{ code?: string; slug?: string; guest?: string }>;
}

export default async function BookingSuccessPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const code = sp.code || "—";
  const guest = sp.guest;

  return (
    <div className="min-h-screen bg-cream font-body flex flex-col">
      <SiteHeader whatsappUrl={WHATSAPP_URL} />

      <main className="flex-1 pt-24 md:pt-32 pb-16 px-4 md:px-8">
        <div className="max-w-xl mx-auto bg-white rounded-3xl border border-brand-100 p-8 md:p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 mx-auto flex items-center justify-center mb-5">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h1 className="font-heading text-3xl md:text-4xl text-gray-900 mb-3 leading-tight">
            Sua solicitação de reserva foi recebida{guest ? `, ${guest.split(" ")[0]}` : ""}!
          </h1>
          <p className="text-gray-600 mb-6 leading-relaxed">
            Em até 24 horas a equipe da Milagres entra em contato para confirmar e enviar instruções de pagamento.
          </p>

          <div className="bg-cream rounded-xl py-5 px-6 mb-6">
            <div className="text-[10px] uppercase tracking-[0.3em] text-gray-400 mb-1">
              Código da reserva
            </div>
            <div className="font-mono text-2xl font-bold text-brand-600">{code}</div>
          </div>

          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-brand-500 hover:bg-brand-600 text-brand-100 font-semibold text-sm shadow"
          >
            <MessageCircle size={15} /> Falar pelo WhatsApp agora
          </a>

          <div className="mt-8">
            <Link
              href={sp.slug ? `/p/${sp.slug}` : "/"}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600"
            >
              <ArrowLeft size={13} /> {sp.slug ? "Voltar para a propriedade" : "Voltar para o início"}
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter whatsappUrl={WHATSAPP_URL} />
    </div>
  );
}
