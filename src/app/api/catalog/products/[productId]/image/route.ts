import { isProductId } from "@/domain/validation";
import { getCatalogProductImage } from "@/server/catalog/admin-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ productId: string }> },
): Promise<Response> {
  const { productId } = await context.params;
  if (!isProductId(productId)) return new Response(null, { status: 404 });
  const image = await getCatalogProductImage(productId);
  if (!image) return new Response(null, { status: 404 });

  const etag = `"${image.etag}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": "no-cache" },
    });
  }

  return new Response(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.bytes.byteLength),
      "Cache-Control": "no-cache",
      ETag: etag,
    },
  });
}
