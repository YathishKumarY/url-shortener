import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cacheDel } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { updateLinkSchema, formatZodErrors } from "@/lib/validators";

export async function GET(_request: Request, ctx: RouteContext<"/api/links/[id]">) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const link = await prisma.link.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    return NextResponse.json(link);
  } catch (error) {
    console.error("[links] Failed to fetch link:", error);
    return NextResponse.json({ error: "Failed to fetch link. Please try again." }, { status: 500 });
  }
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/links/[id]">) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body. Please send valid JSON." },
      { status: 400 },
    );
  }

  const parsed = updateLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodErrors(parsed.error) }, { status: 400 });
  }

  try {
    const link = await prisma.link.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    const { customAlias, expiresAt, originalUrl } = parsed.data;

    if (typeof customAlias === "string" && customAlias !== "") {
      if (customAlias !== link.customAlias && customAlias !== link.shortCode) {
        const existing = await prisma.link.findUnique({
          where: { shortCode: customAlias },
        });
        if (existing && existing.id !== id) {
          return NextResponse.json({ error: "This alias is already taken" }, { status: 409 });
        }
        updateData.shortCode = customAlias;
        updateData.customAlias = customAlias;
      }
    }

    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    if (typeof originalUrl === "string" && originalUrl !== "") {
      updateData.originalUrl = originalUrl;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(link);
    }

    const updated = await prisma.link.update({
      where: { id },
      data: updateData,
    });

    // Drop the cache for both the old and the new code after any change.
    // Expiry edits matter as much as URL edits here: the cached entry carries
    // its own expiresAt, so leaving it in place would keep serving the old
    // expiry (or keep a freshly expired link alive) for up to a day.
    const staleKeys = new Set([`link:${link.shortCode}`, `link:${updated.shortCode}`]);
    await Promise.all(Array.from(staleKeys).map((key) => cacheDel(key)));

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[links] Failed to update link:", error);
    return NextResponse.json(
      { error: "Failed to update link. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/links/[id]">) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    const link = await prisma.link.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!link) {
      return NextResponse.json({ error: "Link not found" }, { status: 404 });
    }

    await Promise.all([prisma.link.delete({ where: { id } }), cacheDel(`link:${link.shortCode}`)]);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[links] Failed to delete link:", error);
    return NextResponse.json(
      { error: "Failed to delete link. Please try again." },
      { status: 500 },
    );
  }
}
