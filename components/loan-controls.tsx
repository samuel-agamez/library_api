"use client";

import { useActionState } from "react";
import {
  loanTransitionAction,
  requestLoanAction,
  uploadCoverAction,
  type FormState,
} from "@/app/actions";
import { Alert, buttonClass, inputClass, secondaryButtonClass } from "./ui";

const initial: FormState = {};

/** Estudiante: botón "Solicitar préstamo". */
export function RequestLoanButton({ bookId, disabled }: { bookId: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(() => requestLoanAction(bookId), initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <button type="submit" disabled={disabled || pending} className={buttonClass}>
        {pending ? "Enviando…" : disabled ? "Sin ejemplares disponibles" : "Solicitar préstamo"}
      </button>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="ok">{state.ok}</Alert>}
    </form>
  );
}

const LABELS = { approve: "Prestar", reject: "Rechazar", return: "Registrar devolución" } as const;

/** Bibliotecario: botones según el estado del préstamo. */
export function LoanActions({
  loanId,
  actions,
}: {
  loanId: string;
  actions: (keyof typeof LABELS)[];
}) {
  const [state, action, pending] = useActionState(
    (_prev: FormState, formData: FormData) =>
      loanTransitionAction(loanId, String(formData.get("action"))),
    initial,
  );
  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {actions.map((a) => (
          <button
            key={a}
            name="action"
            value={a}
            disabled={pending}
            className={a === "approve" ? buttonClass : secondaryButtonClass}>
            {LABELS[a]}
          </button>
        ))}
      </div>
      {state.error && <Alert kind="error">{state.error}</Alert>}
    </form>
  );
}

/** Bibliotecario: subir/cambiar portada (equivalente web de la cámara en la app). */
export function CoverUploadForm({ bookId }: { bookId: string }) {
  const [state, action, pending] = useActionState(uploadCoverAction.bind(null, bookId), initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Cambiar portada (JPEG, PNG o WebP, máx. ~500 KB)
        <input
          name="cover"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
          className={inputClass}
        />
      </label>
      <button type="submit" disabled={pending} className={secondaryButtonClass}>
        {pending ? "Subiendo…" : "Subir portada"}
      </button>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      {state.ok && <Alert kind="ok">{state.ok}</Alert>}
    </form>
  );
}
