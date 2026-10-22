/**
 * Crea (o actualiza) un usuario con un rol concreto. Sirve para dar de alta al primer bibliotecario real.
 *   pnpm create-user -- correo@dominio.com "Contraseña" "Nombre Apellido" librarian
 * Si el correo ya existe, se le asigna la contraseña, el nombre y el rol indicados.
 * Ojo: la contraseña queda en el historial de tu terminal; cámbiala luego desde la consola de Firebase si es sensible.
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const [email, password, displayName, role] = process.argv.slice(2).filter((a) => a !== "--");
if (!email || !password || !displayName || (role !== "librarian" && role !== "student")) {
  console.error('Uso: pnpm create-user -- <correo> <contraseña> "<nombre>" <librarian|student>');
  process.exit(1);
}
if (password.length < 6) {
  console.error("Firebase exige contraseñas de al menos 6 caracteres.");
  process.exit(1);
}

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  }),
});
const auth = getAuth();

let uid: string;
try {
  uid = (await auth.getUserByEmail(email)).uid;
  await auth.updateUser(uid, { password, displayName });
  console.log(`= usuario existente actualizado: ${email}`);
} catch (err) {
  if ((err as { code?: string }).code !== "auth/user-not-found") throw err;
  uid = (await auth.createUser({ email, password, displayName })).uid;
  console.log(`+ usuario creado: ${email}`);
}

await auth.setCustomUserClaims(uid, { role });
await auth.revokeRefreshTokens(uid);
await getFirestore()
  .collection("users")
  .doc(uid)
  .set({ email, displayName, role, createdAt: new Date().toISOString() }, { merge: true });

// Comprobación real: iniciar sesión y leer el rol que viaja dentro del token.
const res = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_WEB_API_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  },
);
const body = (await res.json()) as { idToken?: string; error?: { message?: string } };
if (!body.idToken) {
  console.error("✗ No se pudo iniciar sesión:", body.error?.message);
  process.exit(1);
}
const claims = await auth.verifyIdToken(body.idToken);
console.log(`✓ Inicio de sesión correcto. Rol en el token: ${claims.role}`);
