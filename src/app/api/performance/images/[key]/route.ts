import { parseSocialImagePathKey } from "@/lib/performance/social-image-keys";
import {
  loadStoredSocialImage,
  storedSocialImageResponse,
} from "@/lib/performance/social-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ key: string }> };

export async function GET(_request: Request, { params }: Context) {
  const publicKey = parseSocialImagePathKey((await params).key);
  if (!publicKey) return new Response("Image not found", { status: 404 });

  try {
    const image = await loadStoredSocialImage(publicKey);
    return image
      ? storedSocialImageResponse(image)
      : new Response("Image not found", { status: 404 });
  } catch (error) {
    console.error("[performance/social-image]", publicKey, error);
    return new Response("Performance image unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
