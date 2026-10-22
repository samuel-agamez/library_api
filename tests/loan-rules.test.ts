import { describe, expect, it } from "vitest";
import { applyAction, assertCanRequest, LOAN_DAYS } from "@/lib/domain/loan-rules";
import { ApiError } from "@/lib/errors";

const now = new Date("2026-10-12T10:00:00.000Z");

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return (e as ApiError).code;
  }
}

describe("assertCanRequest", () => {
  it("permite solicitar un libro disponible sin préstamos activos", () => {
    expect(() => assertCanRequest({ id: "b1", availableCopies: 1 }, [])).not.toThrow();
  });

  it("permite volver a pedir un libro ya devuelto o rechazado", () => {
    const loans = [
      { bookId: "b1", status: "returned" as const },
      { bookId: "b1", status: "rejected" as const },
    ];
    expect(() => assertCanRequest({ id: "b1", availableCopies: 1 }, loans)).not.toThrow();
  });

  it("rechaza con ALREADY_ACTIVE si ya hay solicitud o préstamo del mismo libro", () => {
    for (const status of ["requested", "approved"] as const) {
      expect(
        codeOf(() =>
          assertCanRequest({ id: "b1", availableCopies: 2 }, [{ bookId: "b1", status }]),
        ),
      ).toBe("ALREADY_ACTIVE");
    }
  });

  it("no confunde préstamos activos de otro libro", () => {
    expect(() =>
      assertCanRequest({ id: "b1", availableCopies: 1 }, [{ bookId: "b2", status: "approved" }]),
    ).not.toThrow();
  });

  it("rechaza con NO_COPIES si no quedan ejemplares", () => {
    expect(codeOf(() => assertCanRequest({ id: "b1", availableCopies: 0 }, []))).toBe("NO_COPIES");
  });
});

describe("applyAction", () => {
  const book = { availableCopies: 2, totalCopies: 3 };

  it("approve: fija fecha de entrega a LOAN_DAYS y descuenta un ejemplar", () => {
    const t = applyAction({ status: "requested", dueDate: null }, book, "approve", now);
    expect(t.loan.status).toBe("approved");
    expect(t.copiesDelta).toBe(-1);
    const due = new Date(t.loan.dueDate!);
    expect((due.getTime() - now.getTime()) / 86_400_000).toBe(LOAN_DAYS);
  });

  it("approve: falla sin ejemplares disponibles", () => {
    const code = codeOf(() =>
      applyAction(
        { status: "requested", dueDate: null },
        { availableCopies: 0, totalCopies: 3 },
        "approve",
        now,
      ),
    );
    expect(code).toBe("NO_COPIES");
  });

  it("approve: solo desde requested", () => {
    for (const status of ["approved", "rejected", "returned"] as const) {
      expect(codeOf(() => applyAction({ status, dueDate: null }, book, "approve", now))).toBe(
        "INVALID_STATE",
      );
    }
  });

  it("reject: no cambia ejemplares", () => {
    const t = applyAction({ status: "requested", dueDate: null }, book, "reject", now);
    expect(t.loan.status).toBe("rejected");
    expect(t.copiesDelta).toBe(0);
  });

  it("return: devuelve el ejemplar y conserva la fecha de entrega", () => {
    const due = "2026-10-26T10:00:00.000Z";
    const t = applyAction({ status: "approved", dueDate: due }, book, "return", now);
    expect(t.loan.status).toBe("returned");
    expect(t.loan.dueDate).toBe(due);
    expect(t.copiesDelta).toBe(1);
  });

  it("return: nunca supera el total de ejemplares", () => {
    const t = applyAction(
      { status: "approved", dueDate: null },
      { availableCopies: 3, totalCopies: 3 },
      "return",
      now,
    );
    expect(t.copiesDelta).toBe(0);
  });

  it("return: solo desde approved", () => {
    expect(
      codeOf(() => applyAction({ status: "requested", dueDate: null }, book, "return", now)),
    ).toBe("INVALID_STATE");
  });
});
