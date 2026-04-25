import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
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
        await redis.del(`link:${link.shortCode}`).catch((err) => {
          console.error("[links] Redis delete failed:", err);
        });
        updateData.shortCode = customAlias;
        updateData.customAlias = customAlias;
      }
    }

    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    if (typeof originalUrl === "string" && originalUrl !== "") {
      const protocol = new URL(originalUrl).protocol;
      if (!["http:", "https:"].includes(protocol)) {
        return NextResponse.json(
          { error: "Only http and https URLs are allowed" },
          { status: 400 },
        );
      }
      updateData.originalUrl = originalUrl;
      await redis.del(`link:${link.shortCode}`).catch((err) => {
        console.error("[links] Redis delete failed:", err);
      });
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(link);
    }

    const updated = await prisma.link.update({
      where: { id },
      data: updateData,
    });

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

    await Promise.all([
      prisma.link.delete({ where: { id } }),
      redis.del(`link:${link.shortCode}`).catch((err) => {
        console.error("[links] Redis delete failed:", err);
      }),
    ]);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[links] Failed to delete link:", error);
    return NextResponse.json(
      { error: "Failed to delete link. Please try again." },
      { status: 500 },
    );
  }
}
