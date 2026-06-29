"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button, ConfirmDialog, toast } from "@/components/ui";

interface DeleteReservationButtonProps {
  reservationId: string;
}

export function DeleteReservationButton({ reservationId }: DeleteReservationButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const onDelete = async () => {
    try {
      const res = await fetch(`/api/reservations/${reservationId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha ao excluir");
      setOpen(false);
      toast({ variant: "success", title: "Reserva excluída" });
      router.push("/reservations");
      router.refresh();
    } catch (err) {
      toast({
        variant: "error",
        title: "Não foi possível excluir",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <>
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        <Trash2 size={14} aria-hidden="true" />
        Excluir reserva
      </Button>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Excluir esta reserva?"
        description="Ela será removida das listas e da agenda. Esta ação não pode ser desfeita."
        confirmLabel="Sim, excluir"
        cancelLabel="Manter reserva"
        variant="danger"
        onConfirm={onDelete}
      />
    </>
  );
}
