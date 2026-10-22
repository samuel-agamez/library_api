/**
 * Asigna el rol de un usuario existente.
 *   pnpm set-role -- correo@dominio.com librarian
 *   pnpm set-role -- correo@dominio.com student
 * El usuario debe cerrar sesión y volver a entrar (o refrescar el token) para ver el cambio.
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const [email, role] = process.argv.slice(2).filter((a) => a !== "--");
if (!email || (role !== "librarian" && role !== "student")) {
  console.error("Uso: pnpm set-role -- <correo> <librarian|student>");
  process.exit(1);
}

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  }),
});

const user = await getAuth().getUserByEmail(email);
await getAuth().setCustomUserClaims(user.uid, { role });
await getAuth().revokeRefreshTokens(user.uid);
await getFirestore().collection("users").doc(user.uid).set({ role }, { merge: true });
console.log(`${email} ahora es ${role}`);
