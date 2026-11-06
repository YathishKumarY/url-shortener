"use client";

import { useState } from "react";
import { Download, KeyRound, Loader2, LogOut, ShieldAlert, Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Field, inputClass, Panel, PanelHeader, pill } from "@/components/shared/ui-kit";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAccount, useChangePassword, useDeleteAccount } from "@/hooks/use-settings";
import { ApiError, downloadFrom } from "@/lib/api-client";
import { cn } from "@/lib/utils";

function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const change = useChangePassword();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) return setError("Use at least 8 characters");
    if (next !== confirm) return setError("Passwords do not match");
    try {
      await change.mutateAsync({
        currentPassword: hasPassword ? current : undefined,
        newPassword: next,
      });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success(
        hasPassword ? "Password changed" : "Password set - you can now sign in with email too",
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not change password");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {hasPassword && (
          <Field label="Current password">
            <input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={inputClass}
            />
          </Field>
        )}
        <Field label="New password">
          <input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Confirm new password">
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
      <div className="flex justify-end">
        <button
          type="submit"
          className={cn(pill.primary, pill.small)}
          disabled={!next || change.isPending}
        >
          {change.isPending && <Loader2 className="animate-spin" />}{" "}
          {hasPassword ? "Change password" : "Set password"}
        </button>
      </div>
    </form>
  );
}

export function AccountTab() {
  const { data: account } = useAccount();
  const remove = useDeleteAccount();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const canDelete = !!account?.email && typed.trim().toLowerCase() === account.email.toLowerCase();

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          icon={KeyRound}
          title={account?.hasPassword ? "Password" : "Set a password"}
          description={
            account?.hasPassword
              ? "Change the password you sign in with."
              : "You sign in with a social account. Add a password to sign in with email too."
          }
        />
        {account && <PasswordForm hasPassword={account.hasPassword} />}
      </Panel>

      <Panel>
        <PanelHeader
          icon={Download}
          title="Export your data"
          description="Everything in your account - links, settings, tags, domains - as one JSON file."
          action={
            <button
              type="button"
              className={cn(pill.secondary, pill.small)}
              onClick={() => downloadFrom("/api/account/export")}
            >
              <Download /> Download
            </button>
          }
        />
      </Panel>

      <Panel className="border-destructive/40">
        <PanelHeader
          icon={ShieldAlert}
          title="Danger zone"
          description="Sign out everywhere or permanently delete your account."
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(pill.secondary, pill.small)}
            onClick={() => signOut({ callbackUrl: "/" })}
          >
            <LogOut /> Sign out
          </button>
          <button
            type="button"
            className={cn(pill.danger, pill.small)}
            onClick={() => setOpen(true)}
          >
            <Trash2 /> Delete account
          </button>
        </div>
      </Panel>

      <Dialog open={open} onOpenChange={(v) => !remove.isPending && setOpen(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="text-foreground text-base font-semibold">
            Delete your account?
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
            All of your links stop working immediately and every click, tag, domain, webhook and API
            key is deleted. This cannot be undone. Type{" "}
            <span className="text-foreground font-medium">{account?.email}</span> to confirm.
          </DialogDescription>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            aria-label="Confirm email"
            className={inputClass}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={cn(pill.secondary, pill.small)}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={cn(pill.danger, pill.small)}
              disabled={!canDelete || remove.isPending}
              onClick={async () => {
                try {
                  await remove.mutateAsync(typed.trim());
                  await signOut({ callbackUrl: "/" });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not delete account");
                }
              }}
            >
              {remove.isPending && <Loader2 className="animate-spin" />} Delete forever
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
