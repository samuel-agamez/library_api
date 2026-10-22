import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/errors";

const verifyIdToken = vi.fn();
vi.mock("@/lib/services/auth", () => ({ verifyIdToken: (t: string) => verifyIdToken(t) }));

import { assertRole, requireUser } from "@/lib/guard";

const req = (authorization?: string) =>
  new Request("http://x/api", { headers: authorization ? { authorization } : {} });

beforeEach(() => verifyIdToken.mockReset());

describe("requireUser", () => {
  it("rechaza peticiones sin cabecera Authorization", async () => {
    await expect(requireUser(req())).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });

  it("rechaza esquemas distintos de Bearer", async () => {
    await expect(requireUser(req("Basic abc"))).rejects.toMatchObject({ status: 401 });
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("devuelve el usuario verificado", async () => {
    const user = { uid: "u1", email: "a@b.co", name: "Ana", role: "student" };
    verifyIdToken.mockResolvedValue(user);
    await expect(requireUser(req("Bearer tok"))).resolves.toEqual(user);
    expect(verifyIdToken).toHaveBeenCalledWith("tok");
  });
});

describe("assertRole", () => {
  const student = { uid: "u1", email: "a@b.co", name: "Ana", role: "student" as const };
  it("permite el rol correcto", () => {
    expect(() => assertRole(student, "student")).not.toThrow();
  });
  it("lanza 403 si el rol no coincide", () => {
    try {
      assertRole(student, "librarian");
      throw new Error("debía fallar");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(403);
    }
  });
});
