"use client";

import { useState } from "react";
import { Loader2, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Field, inputClass, Panel, PanelHeader, pill } from "@/components/shared/ui-kit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccount, useUpdateProfile } from "@/hooks/use-settings";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AccountInfo } from "@/types";

function ProfileForm({ account }: { account: AccountInfo }) {
  const [name, setName] = useState(account.name ?? "");
  const [image, setImage] = useState(account.image ?? "");
  const update = useUpdateProfile();
  const dirty = name !== (account.name ?? "") || image !== (account.image ?? "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update.mutateAsync({ name: name.trim(), image: image.trim() || null });
      toast.success("Profile updated. It shows everywhere after your next sign-in.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update profile");
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarImage src={image || undefined} />
          <AvatarFallback className="bg-primary text-primary-foreground text-xl font-bold">
            {(name || account.email || "?").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-foreground truncate font-semibold">{name || "Unnamed"}</p>
          <p className="text-muted-foreground truncate text-sm">{account.email}</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Member since {formatDate(account.createdAt)}
            {account.role === "ADMIN" && " · Admin"}
            {account.providers.length > 0 && ` · Signs in with ${account.providers.join(", ")}`}
          </p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="profile-name">
          <input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className={inputClass}
          />
        </Field>
        <Field label="Avatar URL" htmlFor="profile-image" hint="Any public image URL.">
          <input
            id="profile-image"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://..."
            className={inputClass}
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!dirty || update.isPending}
          className={cn(pill.primary, pill.small)}
        >
          {update.isPending && <Loader2 className="animate-spin" />}
          Save profile
        </button>
      </div>
    </form>
  );
}

export function ProfileTab() {
  const { data: account, isLoading } = useAccount();
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          icon={UserRound}
          title="Profile"
          description="How you appear in the dashboard."
        />
        {isLoading || !account ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <ProfileForm account={account} />
        )}
      </Panel>

      <Panel>
        <PanelHeader
          icon={Sun}
          title="Appearance"
          description="Linkly looks great in both themes."
        />
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: "light", label: "Light", icon: Sun },
            { value: "dark", label: "Dark", icon: Moon },
            { value: "system", label: "System", icon: Monitor },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTheme(option.value)}
              className={cn(
                "border-border hover:border-primary/50 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-medium transition-colors",
                theme === option.value && "border-primary bg-primary/8 ring-primary/30 ring-2",
              )}
            >
              <option.icon className="size-5" />
              {option.label}
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
