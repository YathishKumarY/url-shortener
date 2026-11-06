import { redirect } from "next/navigation";
import { TabNav } from "@/components/dashboard/tab-nav";
import { TopBar } from "@/components/dashboard/top-bar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin?callbackUrl=/admin");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, bannedAt: true },
  });
  if (!user || user.role !== "ADMIN" || user.bannedAt) redirect("/dashboard");

  return (
    <div className="bg-background relative min-h-screen overflow-x-clip">
      {/* Decorative cubes */}
      <div className="pointer-events-none absolute -top-16 -left-16 h-[500px] w-[500px] opacity-60">
        <div className="cube absolute bottom-0 left-0 h-[200px] w-[200px]" />
        <div className="cube absolute top-4 right-8 h-[155px] w-[155px]" />
        <div className="cube absolute right-0 bottom-8 h-[200px] w-[200px]" />
      </div>

      <TopBar />
      <TabNav />
      <main className="relative z-10 px-4 py-4 sm:px-6 sm:py-6">{children}</main>
    </div>
  );
}
