import { z } from "zod";
import { ApiError } from "./errors";

const envSchema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_CLIENT_EMAIL: z.string().min(1),
  FIREBASE_PRIVATE_KEY: z.string().min(1),
  /** "Web API Key" de la configuración del proyecto Firebase (para Auth REST). */
  FIREBASE_WEB_API_KEY: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Se valida de forma perezosa para que `next build` no exija secretos. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join("."));
    throw new ApiError(
      500,
      "CONFIG_ERROR",
      `Faltan variables de entorno: ${missing.join(", ")}. Revisa .env`,
    );
  }
  cached = {
    ...parsed.data,
    // En .env las saltos de línea de la llave privada llegan escapadas como \n
    FIREBASE_PRIVATE_KEY: parsed.data.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  };
  return cached;
}
