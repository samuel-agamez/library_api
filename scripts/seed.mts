/**
 * Carga los 10 libros de ejemplo en Firestore.
 *   pnpm seed            → crea los que falten (no pisa ejemplares de libros existentes)
 *   pnpm seed -- --reset → vuelve a escribir los 10 libros desde cero
 *
 * NO crea usuarios: así no hay cuentas con contraseña conocida escrita en el repositorio.
 * Los usuarios los creas tú con `pnpm create-user` (ver la guía).
 */
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const required = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"] as const;
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Falta ${key}. Completa .env a partir de .env.example`);
    process.exit(1);
  }
}

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
  }),
});

const db = getFirestore();
const reset = process.argv.includes("--reset");

interface SeedBook {
  id: string;
  title: string;
  author: string;
  category: string;
  year: number;
  description: string;
  totalCopies: number;
}

const books: SeedBook[] = [
  {
    id: "cien-anos-de-soledad",
    title: "Cien años de soledad",
    author: "Gabriel García Márquez",
    category: "Novela",
    year: 1967,
    description:
      "La historia de la familia Buendía a lo largo de siete generaciones en el pueblo ficticio de Macondo.",
    totalCopies: 3,
  },
  {
    id: "don-quijote",
    title: "Don Quijote de la Mancha",
    author: "Miguel de Cervantes",
    category: "Clásicos",
    year: 1605,
    description:
      "Un hidalgo enloquecido por los libros de caballerías sale a recorrer La Mancha junto a su escudero Sancho Panza.",
    totalCopies: 2,
  },
  {
    id: "amor-en-los-tiempos-del-colera",
    title: "El amor en los tiempos del cólera",
    author: "Gabriel García Márquez",
    category: "Novela",
    year: 1985,
    description: "Una historia de amor que espera más de cincuenta años en una ciudad del Caribe.",
    totalCopies: 2,
  },
  {
    id: "rayuela",
    title: "Rayuela",
    author: "Julio Cortázar",
    category: "Novela",
    year: 1963,
    description: "Novela que puede leerse en más de un orden, entre París y Buenos Aires.",
    totalCopies: 1,
  },
  {
    id: "pedro-paramo",
    title: "Pedro Páramo",
    author: "Juan Rulfo",
    category: "Novela",
    year: 1955,
    description:
      "Juan Preciado llega a Comala en busca de su padre y encuentra un pueblo poblado por voces de muertos.",
    totalCopies: 2,
  },
  {
    id: "la-ciudad-y-los-perros",
    title: "La ciudad y los perros",
    author: "Mario Vargas Llosa",
    category: "Novela",
    year: 1963,
    description: "La vida de un grupo de cadetes en un colegio militar de Lima.",
    totalCopies: 1,
  },
  {
    id: "clean-code",
    title: "Clean Code",
    author: "Robert C. Martin",
    category: "Tecnología",
    year: 2008,
    description:
      "Principios y prácticas para escribir código legible, mantenible y fácil de cambiar.",
    totalCopies: 3,
  },
  {
    id: "introduction-to-algorithms",
    title: "Introduction to Algorithms",
    author: "Cormen, Leiserson, Rivest y Stein",
    category: "Tecnología",
    year: 1990,
    description:
      "Referencia clásica de algoritmos y estructuras de datos con análisis de complejidad.",
    totalCopies: 2,
  },
  {
    id: "pragmatic-programmer",
    title: "The Pragmatic Programmer",
    author: "Andrew Hunt y David Thomas",
    category: "Tecnología",
    year: 1999,
    description:
      "Consejos prácticos para el oficio de desarrollar software a lo largo de una carrera.",
    totalCopies: 2,
  },
  {
    id: "dont-make-me-think",
    title: "Don't Make Me Think",
    author: "Steve Krug",
    category: "Diseño",
    year: 2000,
    description:
      "Una guía breve sobre usabilidad para que las interfaces se entiendan sin esfuerzo.",
    totalCopies: 2,
  },
];

async function seedBooks() {
  for (const { id, ...book } of books) {
    const ref = db.collection("books").doc(id);
    const exists = (await ref.get()).exists;
    if (exists && !reset) {
      console.log(`= libro existente: ${book.title}`);
      continue;
    }
    await ref.set({
      ...book,
      availableCopies: book.totalCopies,
      coverVersion: 0,
      updatedAt: new Date().toISOString(),
    });
    console.log(`+ libro: ${book.title}`);
  }
}

await seedBooks();
console.log("\nListo. Ahora crea tus usuarios con:");
console.log('  pnpm create-user -- correo@dominio.com "clave" "Nombre" student');
console.log('  pnpm create-user -- correo@dominio.com "clave" "Nombre" librarian');
