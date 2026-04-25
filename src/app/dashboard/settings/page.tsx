"use client";

import { LogOut, Moon, Sun, User } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function SettingsPage() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-foreground text-xl font-bold">Settings</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Manage your account settings and preferences.
      </p>

      <Separator className="my-6" />

      <div className="space-y-6">
        <div className="border-border bg-card rounded-lg border p-6">
          <h2 className="text-foreground mb-4 text-sm font-semibold">Profile</h2>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={session?.user?.image ?? undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {session?.user?.name?.charAt(0)?.toUpperCase() ?? <User className="h-6 w-6" />}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-foreground text-sm font-medium">{session?.user?.name ?? "User"}</p>
              <p className="text-muted-foreground text-sm">{session?.user?.email}</p>
            </div>
          </div>
        </div>

        <div className="border-border bg-card rounded-lg border p-6">
          <h2 className="text-foreground mb-4 text-sm font-semibold">Appearance</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-foreground text-sm">Theme</p>
              <p className="text-muted-foreground text-xs">Choose between light and dark mode</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("light")}
              >
                <Sun className="mr-2 h-4 w-4" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme("dark")}
              >
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </Button>
            </div>
          </div>
        </div>

        <div className="border-destructive/30 bg-card rounded-lg border p-6">
          <h2 className="text-foreground mb-2 text-sm font-semibold">Danger Zone</h2>
          <p className="text-muted-foreground mb-4 text-xs">Sign out of your account</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
