import { stores } from "@/data/provisional";
import {
  ClientProfileValidationError,
  parseClientProfileUpdate,
  validateAvatarFile,
} from "@/domain/profile";
import { getAuthenticatedClientSession } from "@/server/auth/session";
import { validateAvatarBytes } from "@/server/profile/avatar";
import {
  ClientProfileRepositoryError,
  updateClientProfile,
} from "@/server/profile/repository";

export const runtime = "nodejs";
const MAX_MULTIPART_BYTES = 5_500_000;

function unauthorized(): Response {
  return Response.json({ message: "Debes iniciar sesión." }, { status: 401 });
}

export async function PATCH(request: Request): Promise<Response> {
  const session = await getAuthenticatedClientSession();
  if (!session) return unauthorized();
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) {
    return Response.json(
      { message: "La fotografía supera el tamaño permitido.", errors: { avatar: "Máximo 5 MB." } },
      { status: 413 },
    );
  }
  try {
    const formData = await request.formData();
    const profileValue = formData.get("profile");
    if (typeof profileValue !== "string" || profileValue.length > 4_096) {
      throw new ClientProfileValidationError({ fullName: "Revisa los datos enviados." });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(profileValue) as unknown;
    } catch {
      throw new ClientProfileValidationError({ fullName: "Revisa los datos enviados." });
    }
    const input = parseClientProfileUpdate(parsed, stores.map((store) => store.id));
    const avatarValue = formData.get("avatar");
    let avatar: { mimeType: ReturnType<typeof validateAvatarFile>; bytes: Buffer } | null = null;
    if (avatarValue instanceof File && avatarValue.size > 0) {
      const mimeType = validateAvatarFile(avatarValue);
      const bytes = Buffer.from(await avatarValue.arrayBuffer());
      validateAvatarBytes(mimeType, bytes);
      avatar = { mimeType, bytes };
    }
    const profile = await updateClientProfile(session.userId, input, avatar);
    return Response.json({ profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    if (error instanceof ClientProfileValidationError) {
      return Response.json(
        { message: error.message, errors: error.errors },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof ClientProfileRepositoryError) {
      const status = error.code === "EMAIL_ALREADY_EXISTS" ? 409 : 404;
      return Response.json(
        { message: error.message, errors: error.code === "EMAIL_ALREADY_EXISTS" ? { email: error.message } : {} },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(
      { message: "No fue posible guardar el perfil." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
