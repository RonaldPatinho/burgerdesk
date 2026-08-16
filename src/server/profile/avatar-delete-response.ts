import type { ClientProfileView } from "../../domain/profile";
import { ClientProfileRepositoryError } from "./repository";

interface ClientAvatarSession {
  userId: string;
}

interface ClientAvatarDeletionResult {
  deleted: boolean;
  profile: ClientProfileView;
}

type DeleteClientAvatar = (userId: string) => Promise<ClientAvatarDeletionResult>;

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function createDeleteClientAvatarResponse(
  session: ClientAvatarSession | null,
  deleteAvatar: DeleteClientAvatar,
): Promise<Response> {
  if (!session) {
    return Response.json(
      { message: "Debes iniciar sesión." },
      { status: 401, headers: noStoreHeaders },
    );
  }

  try {
    const result = await deleteAvatar(session.userId);
    return Response.json(result, { headers: noStoreHeaders });
  } catch (error: unknown) {
    if (
      error instanceof ClientProfileRepositoryError &&
      error.code === "PROFILE_NOT_FOUND"
    ) {
      return Response.json(
        { message: error.message },
        { status: 404, headers: noStoreHeaders },
      );
    }
    return Response.json(
      { message: "No fue posible eliminar la foto de perfil." },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
