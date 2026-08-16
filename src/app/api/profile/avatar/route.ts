import { getAuthenticatedClientSession } from "@/server/auth/session";
import { createDeleteClientAvatarResponse } from "@/server/profile/avatar-delete-response";
import { deleteClientAvatar, getClientAvatar } from "@/server/profile/repository";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const session = await getAuthenticatedClientSession();
  if (!session) return new Response(null, { status: 401 });
  const avatar = await getClientAvatar(session.userId);
  if (!avatar) return new Response(null, { status: 404 });
  const quotedEtag = `"${avatar.etag}"`;
  if (request.headers.get("if-none-match") === quotedEtag) {
    return new Response(null, { status: 304 });
  }
  return new Response(new Uint8Array(avatar.bytes), {
    headers: {
      "Content-Type": avatar.mimeType,
      "Content-Length": String(avatar.bytes.byteLength),
      "Cache-Control": "private, no-cache",
      ETag: quotedEtag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(): Promise<Response> {
  const session = await getAuthenticatedClientSession();
  return createDeleteClientAvatarResponse(session, deleteClientAvatar);
}
