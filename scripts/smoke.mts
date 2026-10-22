/**
 * Prueba de humo de extremo a extremo contra la API en ejecución y Firebase REAL.
 *   1) pnpm seed            (una vez: carga los libros)
 *   2) pnpm dev  (o build + start)
 *   3) pnpm smoke           (BASE_URL=http://localhost:3000 por defecto)
 * No necesita cuentas fijas: crea un estudiante, otro estudiante y un bibliotecario TEMPORALES con
 * contraseñas aleatorias, y los elimina al terminar junto con los préstamos de prueba.
 */
import { randomUUID } from "node:crypto";
import { deflateSync, crc32 } from "node:zlib";
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const RUN = Date.now();
/** Contraseña aleatoria distinta en cada ejecución: nunca queda escrita en ningún archivo. */
const PASSWORD = `Tmp-${randomUUID()}`;
const STUDENT_EMAIL = `smoke-student-${RUN}@example.test`;
const LIBRARIAN_EMAIL = `smoke-librarian-${RUN}@example.test`;

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
  }),
});

let failures = 0;
function check(name: string, ok: boolean, extra?: unknown) {
  console.log(
    `${ok ? "  ✓" : "  ✗"} ${name}${ok || extra === undefined ? "" : `  → ${JSON.stringify(extra)}`}`,
  );
  if (!ok) failures++;
}

/** Forma mínima de las respuestas que se inspeccionan (las comprobaciones verifican los valores reales). */
interface Dto {
  error?: { code?: string; message?: string };
  user: { email: string; role: string };
  tokens: { idToken: string; refreshToken: string };
  books: { id: string; title: string; availableCopies: number; coverUrl: string | null }[];
  categories: string[];
  book: { id: string; availableCopies: number; coverUrl: string | null };
  loan: { id: string; status: string; dueDate: string | null };
  loans: { id: string; userEmail: string }[];
}
interface Res {
  status: number;
  body: Dto;
  headers: Headers;
}
async function call(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<Res> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let body = {} as Dto;
  try {
    body = JSON.parse(text) as Dto;
  } catch {
    /* respuesta binaria */
  }
  return { status: res.status, body, headers: res.headers };
}

/** PNG sólido de 64x64 generado en memoria (sin dependencias). */
function makePng(): Buffer {
  const size = 64;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    for (let x = 0; x < size; x++) {
      raw[row + 1 + x * 3] = (x * 4) % 256;
      raw[row + 2 + x * 3] = (y * 4) % 256;
      raw[row + 3 + x * 3] = 120;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const createdLoanIds: string[] = [];
const touchedBooks = new Set<string>();
const tempEmail = `smoke-register-${RUN}@example.test`;

/** Crea un usuario temporal con un rol (Admin SDK, igual que `pnpm create-user`). */
async function createTempUser(email: string, displayName: string, role: "student" | "librarian") {
  const created = await getAuth().createUser({ email, password: PASSWORD, displayName });
  await getAuth().setCustomUserClaims(created.uid, { role });
  await getFirestore()
    .collection("users")
    .doc(created.uid)
    .set({ email, displayName, role, createdAt: new Date().toISOString() });
}

async function main() {
  console.log(`Probando ${BASE}\n`);
  await createTempUser(STUDENT_EMAIL, "Smoke Estudiante", "student");
  await createTempUser(LIBRARIAN_EMAIL, "Smoke Bibliotecario", "librarian");

  console.log("Salud y autenticación");
  check("GET /api/health → 200", (await call("GET", "/api/health")).status === 200);
  check("GET /api/books sin token → 401", (await call("GET", "/api/books")).status === 401);
  const bad = await call("POST", "/api/auth/login", {
    body: { email: STUDENT_EMAIL, password: "incorrecta" },
  });
  check(
    "login con contraseña errónea → 401 INVALID_CREDENTIALS",
    bad.status === 401 && bad.body.error?.code === "INVALID_CREDENTIALS",
    bad.body,
  );

  const stu = await call("POST", "/api/auth/login", {
    body: { email: ` ${STUDENT_EMAIL.toUpperCase()} `, password: PASSWORD },
  });
  check("login estudiante (correo con espacios/mayúsculas) → 200", stu.status === 200, stu.body);
  const student = stu.body.tokens.idToken as string;
  check("rol del estudiante = student", stu.body.user.role === "student", stu.body.user);

  const lib = await call("POST", "/api/auth/login", {
    body: { email: LIBRARIAN_EMAIL, password: PASSWORD },
  });
  check(
    "login bibliotecario → 200 con rol librarian",
    lib.status === 200 && lib.body.user.role === "librarian",
    lib.body.user,
  );
  const librarian = lib.body.tokens.idToken as string;

  const ref = await call("POST", "/api/auth/refresh", {
    body: { refreshToken: stu.body.tokens.refreshToken },
  });
  check(
    "refresh token → nuevo idToken",
    ref.status === 200 && !!ref.body.tokens?.idToken,
    ref.body,
  );
  check(
    "GET /api/auth/me",
    (await call("GET", "/api/auth/me", { token: student })).body.user?.email === STUDENT_EMAIL,
  );

  console.log("\nCatálogo");
  const all = await call("GET", "/api/books", { token: student });
  check("hay 10 libros", all.body.books?.length === 10, all.body.books?.length);
  check("devuelve categorías", all.body.categories?.length >= 3, all.body.categories);
  const colera = await call("GET", "/api/books?q=colera", { token: student });
  check(
    "búsqueda sin tildes 'colera' encuentra 'El amor en los tiempos del cólera'",
    colera.body.books?.length === 1,
    colera.body.books?.map((b) => b.title),
  );
  const tech = await call("GET", "/api/books?category=Tecnolog%C3%ADa", { token: student });
  check(
    "filtro por categoría Tecnología → 3",
    tech.body.books?.length === 3,
    tech.body.books?.length,
  );
  const detail = await call("GET", "/api/books/rayuela", { token: student });
  check(
    "detalle de 'rayuela' con 1 ejemplar",
    detail.status === 200 && detail.body.book.availableCopies === 1,
    detail.body,
  );
  check(
    "libro inexistente → 404",
    (await call("GET", "/api/books/no-existe", { token: student })).status === 404,
  );
  const future = await call(
    "GET",
    `/api/books?updatedSince=${encodeURIComponent(new Date(Date.now() + 60_000).toISOString())}`,
    { token: student },
  );
  check("sync incremental: updatedSince futuro → 0 libros", future.body.books?.length === 0);

  console.log("\nPréstamos (estudiante)");
  const rid = `smoke-${Date.now()}-a`;
  const first = await call("POST", "/api/loans", {
    token: student,
    body: { bookId: "clean-code", clientRequestId: rid },
  });
  check(
    "solicitar 'clean-code' → 201 requested",
    first.status === 201 && first.body.loan.status === "requested",
    first.body,
  );
  createdLoanIds.push(first.body.loan?.id);
  touchedBooks.add("clean-code");
  const again = await call("POST", "/api/loans", {
    token: student,
    body: { bookId: "clean-code", clientRequestId: rid },
  });
  check(
    "reintento con el mismo clientRequestId es idempotente → 200 y mismo id",
    again.status === 200 && again.body.loan.id === first.body.loan.id,
    again.body,
  );
  const dup = await call("POST", "/api/loans", {
    token: student,
    body: { bookId: "clean-code", clientRequestId: `${rid}-otro` },
  });
  check(
    "segunda solicitud activa del mismo libro → 409 ALREADY_ACTIVE",
    dup.status === 409 && dup.body.error?.code === "ALREADY_ACTIVE",
    dup.body,
  );
  const missing = await call("POST", "/api/loans", {
    token: student,
    body: { bookId: "no-existe", clientRequestId: `${rid}-x1` },
  });
  check("libro inexistente → 404", missing.status === 404);
  check(
    "clientRequestId inválido → 400",
    (
      await call("POST", "/api/loans", {
        token: student,
        body: { bookId: "clean-code", clientRequestId: "../x" },
      })
    ).status === 400,
  );
  check(
    "estudiante no puede aprobar → 403",
    (
      await call("PATCH", `/api/loans/${first.body.loan.id}`, {
        token: student,
        body: { action: "approve" },
      })
    ).status === 403,
  );
  check(
    "bibliotecario no puede solicitar → 403",
    (
      await call("POST", "/api/loans", {
        token: librarian,
        body: { bookId: "clean-code", clientRequestId: `${rid}-lib` },
      })
    ).status === 403,
  );
  const mine = await call("GET", "/api/loans", { token: student });
  check(
    "GET /api/loans (estudiante) solo trae los suyos",
    mine.body.loans.every((l) => l.userEmail === STUDENT_EMAIL),
  );

  console.log("\nGestión (bibliotecario)");
  const all2 = await call("GET", "/api/loans?status=requested", { token: librarian });
  check(
    "bibliotecario ve la solicitud pendiente",
    all2.body.loans.some((l) => l.id === first.body.loan.id),
    all2.body.loans?.length,
  );
  const ok = await call("PATCH", `/api/loans/${first.body.loan.id}`, {
    token: librarian,
    body: { action: "approve" },
  });
  check(
    "aprobar → approved con fecha de entrega",
    ok.status === 200 && ok.body.loan.status === "approved" && !!ok.body.loan.dueDate,
    ok.body,
  );
  const afterApprove = await call("GET", "/api/books/clean-code", { token: student });
  check(
    "ejemplares disponibles bajaron 3 → 2",
    afterApprove.body.book.availableCopies === 2,
    afterApprove.body.book.availableCopies,
  );
  const delta = await call(
    "GET",
    `/api/books?updatedSince=${encodeURIComponent(new Date(Date.now() - 30_000).toISOString())}`,
    { token: student },
  );
  check(
    "sync incremental trae solo el libro modificado",
    delta.body.books?.length === 1 && delta.body.books[0].id === "clean-code",
    delta.body.books?.map((b) => b.id),
  );
  check(
    "aprobar dos veces → 409 INVALID_STATE",
    (
      await call("PATCH", `/api/loans/${first.body.loan.id}`, {
        token: librarian,
        body: { action: "approve" },
      })
    ).body.error?.code === "INVALID_STATE",
  );
  const ret = await call("PATCH", `/api/loans/${first.body.loan.id}`, {
    token: librarian,
    body: { action: "return" },
  });
  check("devolver → returned", ret.body.loan?.status === "returned", ret.body);
  check(
    "ejemplares vuelven a 3",
    (await call("GET", "/api/books/clean-code", { token: student })).body.book.availableCopies ===
      3,
  );

  console.log("\nConflicto 'sin ejemplares' (el caso de la cola offline)");
  const reg = await call("POST", "/api/auth/register", {
    body: { email: tempEmail, password: PASSWORD, displayName: "Estudiante Temporal" },
  });
  check(
    "registro público crea estudiante → 201",
    reg.status === 201 && reg.body.user.role === "student",
    reg.body,
  );
  const student2 = reg.body.tokens?.idToken as string;
  check(
    "registro con correo repetido → 409 EMAIL_IN_USE",
    (
      await call("POST", "/api/auth/register", {
        body: { email: tempEmail, password: PASSWORD, displayName: "Otra" },
      })
    ).body.error?.code === "EMAIL_IN_USE",
  );
  const l1 = await call("POST", "/api/loans", {
    token: student,
    body: { bookId: "rayuela", clientRequestId: `${rid}-r1` },
  });
  createdLoanIds.push(l1.body.loan?.id);
  touchedBooks.add("rayuela");
  const l2 = await call("POST", "/api/loans", {
    token: student2,
    body: { bookId: "rayuela", clientRequestId: `${rid}-r2` },
  });
  createdLoanIds.push(l2.body.loan?.id);
  check(
    "dos estudiantes piden el último ejemplar (ambas se aceptan como solicitud)",
    l1.status === 201 && l2.status === 201,
    [l1.status, l2.status],
  );
  check(
    "el bibliotecario aprueba la primera",
    (
      await call("PATCH", `/api/loans/${l1.body.loan.id}`, {
        token: librarian,
        body: { action: "approve" },
      })
    ).status === 200,
  );
  const fail = await call("PATCH", `/api/loans/${l2.body.loan.id}`, {
    token: librarian,
    body: { action: "approve" },
  });
  check(
    "aprobar la segunda → 409 NO_COPIES (consistencia garantizada por transacción)",
    fail.status === 409 && fail.body.error?.code === "NO_COPIES",
    fail.body,
  );
  const l3 = await call("POST", "/api/loans", {
    token: student2,
    body: { bookId: "rayuela", clientRequestId: `${rid}-r3` },
  });
  check(
    "solicitar un libro sin ejemplares → 409 (ya hay solicitud activa o NO_COPIES)",
    l3.status === 409,
    l3.body,
  );
  check(
    "estudiante 2 no ve préstamos ajenos por id → 404",
    (await call("GET", `/api/loans/${l1.body.loan.id}`, { token: student2 })).status === 404,
  );

  console.log("\nPortada (semana 12)");
  const png = makePng().toString("base64");
  check(
    "estudiante no puede subir portada → 403",
    (
      await call("PUT", "/api/books/clean-code/cover", {
        token: student,
        body: { contentType: "image/png", data: png },
      })
    ).status === 403,
  );
  const fake = Buffer.from("<html><script>alert(1)</script>".padEnd(200, " ")).toString("base64");
  check(
    "archivo que no es imagen (aunque diga image/png) → 400",
    (
      await call("PUT", "/api/books/clean-code/cover", {
        token: librarian,
        body: { contentType: "image/png", data: fake },
      })
    ).status === 400,
  );
  const up = await call("PUT", "/api/books/clean-code/cover", {
    token: librarian,
    body: { contentType: "image/png", data: png },
  });
  check(
    "bibliotecario sube portada PNG → 200 con coverUrl",
    up.status === 200 && !!up.body.book.coverUrl,
    up.body,
  );
  const img = await fetch(`${BASE}${up.body.book.coverUrl}`);
  check(
    "GET de la portada → image/png con los mismos bytes",
    img.headers.get("content-type") === "image/png" &&
      Buffer.from(await img.arrayBuffer()).toString("base64") === png,
  );
}

async function cleanup() {
  console.log("\nLimpieza");
  const db = getFirestore();
  for (const id of createdLoanIds.filter(Boolean)) await db.collection("loans").doc(id).delete();
  for (const id of touchedBooks) {
    const snap = await db.collection("books").doc(id).get();
    if (!snap.exists) continue;
    await db.collection("bookCovers").doc(id).delete();
    await snap.ref.update({
      availableCopies: snap.data()!.totalCopies,
      coverVersion: 0,
      updatedAt: new Date().toISOString(),
    });
  }
  for (const email of [STUDENT_EMAIL, LIBRARIAN_EMAIL, tempEmail]) {
    try {
      const u = await getAuth().getUserByEmail(email);
      await getAuth().deleteUser(u.uid);
      await db.collection("users").doc(u.uid).delete();
    } catch {
      /* no se llegó a crear */
    }
  }
  const loans = createdLoanIds.filter(Boolean).length;
  console.log(
    `  ${loans} préstamos, ${touchedBooks.size} libros restaurados, usuarios temporales eliminados`,
  );
}

try {
  await main();
} catch (err) {
  failures++;
  console.error("\nError inesperado:", err);
} finally {
  await cleanup();
}
console.log(failures === 0 ? "\n✅ Todo OK" : `\n❌ ${failures} comprobación(es) fallaron`);
process.exit(failures === 0 ? 0 : 1);
