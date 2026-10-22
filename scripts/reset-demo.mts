/**
 * Deja los datos de demostración como al inicio: borra TODOS los préstamos, restaura los ejemplares
 * disponibles y elimina las portadas. No toca usuarios.   pnpm reset-demo
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore();

const loans = await db.collection("loans").get();
await Promise.all(loans.docs.map((d) => d.ref.delete()));

const covers = await db.collection("bookCovers").get();
await Promise.all(covers.docs.map((d) => d.ref.delete()));

const now = new Date().toISOString();
const books = await db.collection("books").get();
await Promise.all(
  books.docs.map((d) =>
    d.ref.update({ availableCopies: d.data().totalCopies, coverVersion: 0, updatedAt: now }),
  ),
);
console.log(
  `Restablecido: ${loans.size} préstamos y ${covers.size} portadas eliminados, ${books.size} libros restaurados`,
);
