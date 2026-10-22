import { describe, expect, it } from "vitest";
import {
  bookQuerySchema,
  coverSchema,
  createLoanSchema,
  loginSchema,
  registerSchema,
} from "@/lib/schemas";

describe("loginSchema", () => {
  it("normaliza el correo", () => {
    expect(loginSchema.parse({ email: "  Ana@Mail.COM ", password: "x" }).email).toBe(
      "ana@mail.com",
    );
  });
  it("rechaza correos inválidos", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("exige contraseña de 6+ caracteres (mínimo de Firebase)", () => {
    expect(
      registerSchema.safeParse({ email: "a@b.co", password: "12345", displayName: "Ana" }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ email: "a@b.co", password: "123456", displayName: "Ana" }).success,
    ).toBe(true);
  });
});

describe("createLoanSchema", () => {
  it("acepta uuid como clientRequestId", () => {
    expect(
      createLoanSchema.safeParse({
        bookId: "clean-code",
        clientRequestId: "3f2b8c1e-7d44-4b9a-9a1e-0c5d2f6a7b11",
      }).success,
    ).toBe(true);
  });
  it("rechaza ids con caracteres raros o muy cortos", () => {
    expect(createLoanSchema.safeParse({ bookId: "x", clientRequestId: "abc" }).success).toBe(false);
    expect(
      createLoanSchema.safeParse({ bookId: "x", clientRequestId: "../../etc/passwd" }).success,
    ).toBe(false);
  });
});

describe("coverSchema", () => {
  it("rechaza tipos no permitidos y base64 inválido", () => {
    const data = "A".repeat(200);
    expect(coverSchema.safeParse({ contentType: "image/gif", data }).success).toBe(false);
    expect(
      coverSchema.safeParse({ contentType: "image/jpeg", data: "no es base64!!" + data }).success,
    ).toBe(false);
    expect(coverSchema.safeParse({ contentType: "image/jpeg", data }).success).toBe(true);
  });
  it("rechaza imágenes por encima del límite", () => {
    expect(
      coverSchema.safeParse({ contentType: "image/png", data: "A".repeat(700_001) }).success,
    ).toBe(false);
  });
});

describe("bookQuerySchema", () => {
  it("valida updatedSince como fecha ISO", () => {
    expect(bookQuerySchema.safeParse({ updatedSince: "2026-10-12T10:00:00.000Z" }).success).toBe(
      true,
    );
    expect(bookQuerySchema.safeParse({ updatedSince: "ayer" }).success).toBe(false);
  });
});
