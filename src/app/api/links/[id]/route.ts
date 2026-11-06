import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { jsonError, readJson, validationError } from "@/lib/http";
import {
  deleteLinks,
  findOwnedLink,
  linkErrorResponse,
  serializeLink,
  updateLink,
} from "@/lib/links";
import { enforceRateLimit, userWriteLimiter } from "@/lib/rate-limit";
import { updateLinkSchema } from "@/lib/validators";

export async function GET(request: Request, ctx: RouteContext<"/api/links/[id]">) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  try {
    const link = await findOwnedLink(id, auth.user.id);
    if (!link) return jsonError("Link not found", 404);
    return NextResponse.json(serializeLink(link, request));
  } catch (err) {
    return linkErrorResponse(err);
  }
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/links/[id]">) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  const limit = await enforceRateLimit(userWriteLimiter, `user:${auth.user.id}`);
  if (!limit.ok) return limit.response;

  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = updateLinkSchema.safeParse(body.body);
  if (!parsed.success) return validationError(parsed.error);

  try {
    const link = await findOwnedLink(id, auth.user.id);
    if (!link) return jsonError("Link not found", 404);
    if (link.bannedAt) return jsonError("This link was disabled by a moderator", 403);

    const updated = await updateLink({ link, input: parsed.data, userId: auth.user.id, request });
    return NextResponse.json(serializeLink(updated, request));
  } catch (err) {
    return linkErrorResponse(err);
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/links/[id]">) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  try {
    const link = await findOwnedLink(id, auth.user.id);
    if (!link) return jsonError("Link not found", 404);
    await deleteLinks(auth.user.id, [link]);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return linkErrorResponse(err);
  }
}
