"use client";

import { useState } from "react";
import {
  Ban,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  ErrorState,
  Pagination,
  RowsSkeleton,
  SearchInput,
  useDebounced,
  usePage,
} from "@/components/admin/admin-shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState, Panel } from "@/components/shared/ui-kit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAdminUsers,
  useDeleteAdminUser,
  useUpdateAdminUser,
  type AdminUser,
} from "@/hooks/use-admin";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

function initials(user: AdminUser) {
  const source = (user.name || user.email).trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function RoleBadge({ role }: { role: AdminUser["role"] }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium ring-1 ring-inset",
        role === "ADMIN"
          ? "bg-primary/12 text-primary ring-primary/25 dark:text-blue-300"
          : "bg-zinc-500/12 text-zinc-700 ring-zinc-500/25 dark:text-zinc-300",
      )}
    >
      {role === "ADMIN" && <ShieldCheck className="size-3" />}
      {role === "ADMIN" ? "Admin" : "User"}
    </span>
  );
}

function UserStatus({ banned }: { banned: boolean }) {
  return banned ? (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-red-500/12 px-2 text-xs font-medium text-red-700 ring-1 ring-red-500/25 ring-inset dark:text-red-300">
      <Ban className="size-3" />
      Banned
    </span>
  ) : (
    <span className="inline-flex h-6 items-center rounded-full bg-green-500/12 px-2 text-xs font-medium text-green-700 ring-1 ring-green-500/25 ring-inset dark:text-green-400">
      Active
    </span>
  );
}

function UserIdentity({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar size="lg">
        {user.image && <AvatarImage src={user.image} alt="" />}
        <AvatarFallback className="text-xs font-semibold">{initials(user)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-foreground truncate text-sm font-medium">
          {user.name || "Unnamed"}
          {isSelf && (
            <span className="text-muted-foreground ml-1.5 text-xs font-normal">(you)</span>
          )}
        </p>
        <p className="text-muted-foreground truncate text-xs">{user.email}</p>
      </div>
    </div>
  );
}

function UserActions({
  user,
  disabled,
  onRole,
  onBan,
  onUnban,
  onDelete,
}: {
  user: AdminUser;
  disabled: boolean;
  onRole: () => void;
  onBan: () => void;
  onUnban: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={`Actions for ${user.email}`}
        title={disabled ? "You cannot change your own account" : undefined}
        className="border-border bg-secondary text-card-foreground hover:text-foreground hover:bg-secondary/70 focus-visible:ring-ring/50 data-popup-open:bg-secondary/70 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onRole}>
          {user.role === "ADMIN" ? <ShieldOff /> : <ShieldCheck />}
          {user.role === "ADMIN" ? "Remove admin" : "Make admin"}
        </DropdownMenuItem>
        {user.bannedAt ? (
          <DropdownMenuItem onClick={onUnban}>
            <UserCheck />
            Unban
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={onBan}>
            <Ban />
            Ban user
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 />
          Delete user
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type Pending = { kind: "ban" | "delete"; user: AdminUser } | null;

export function UsersTab() {
  const { data: session } = useSession();
  const selfId = (session?.user as { id?: string } | undefined)?.id;

  const [input, setInput] = useState("");
  const search = useDebounced(input.trim(), 300);
  const [page, setPage] = usePage(search);
  const [pending, setPending] = useState<Pending>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useAdminUsers(search, page);
  const update = useUpdateAdminUser();
  const remove = useDeleteAdminUser();

  async function act(
    vars: { id: string; role?: "USER" | "ADMIN"; banned?: boolean },
    success: string,
  ) {
    try {
      await update.mutateAsync(vars);
      toast.success(success);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  async function removeUser(user: AdminUser) {
    try {
      await remove.mutateAsync(user.id);
      toast.success(`${user.email} was deleted`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function actionsFor(user: AdminUser) {
    return (
      <UserActions
        user={user}
        disabled={user.id === selfId}
        onRole={() =>
          void act(
            { id: user.id, role: user.role === "ADMIN" ? "USER" : "ADMIN" },
            user.role === "ADMIN"
              ? `${user.email} is no longer an admin`
              : `${user.email} is now an admin`,
          )
        }
        onBan={() => setPending({ kind: "ban", user })}
        onUnban={() => void act({ id: user.id, banned: false }, `${user.email} was unbanned`)}
        onDelete={() => setPending({ kind: "delete", user })}
      />
    );
  }

  return (
    <div>
      <div className="mb-4">
        <SearchInput
          value={input}
          onChange={setInput}
          placeholder="Search by name or email"
          label="Search users"
        />
      </div>

      {isLoading ? (
        <RowsSkeleton />
      ) : isError || !data ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : data.users.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? "No matching users" : "No users yet"}
          description={
            search ? `Nothing matched "${search}".` : "Users will appear here once they sign up."
          }
        />
      ) : (
        <>
          {/* Desktop table */}
          <Panel className="hidden overflow-hidden p-0 md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Links</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-14 pr-4">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((user) => (
                  <TableRow key={user.id} className={cn(user.bannedAt && "bg-red-500/5")}>
                    <TableCell className="max-w-[320px] py-3 pl-4">
                      <UserIdentity user={user} isSelf={user.id === selfId} />
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={user.role} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(user.linkCount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDate(user.createdAt)}
                    </TableCell>
                    <TableCell>
                      <UserStatus banned={!!user.bannedAt} />
                    </TableCell>
                    <TableCell className="pr-4 text-right">{actionsFor(user)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>

          {/* Mobile cards */}
          <ul className="space-y-2 md:hidden">
            {data.users.map((user) => (
              <li key={user.id}>
                <Panel className={cn("p-4", user.bannedAt && "border-red-500/30 bg-red-500/5")}>
                  <div className="flex items-start justify-between gap-3">
                    <UserIdentity user={user} isSelf={user.id === selfId} />
                    {actionsFor(user)}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <RoleBadge role={user.role} />
                    <UserStatus banned={!!user.bannedAt} />
                    <span className="text-muted-foreground ml-auto text-xs tabular-nums">
                      {formatNumber(user.linkCount)} {user.linkCount === 1 ? "link" : "links"} -
                      joined {formatDate(user.createdAt)}
                    </span>
                  </div>
                </Panel>
              </li>
            ))}
          </ul>

          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            noun={data.total === 1 ? "user" : "users"}
            onPageChange={setPage}
            fetching={isFetching}
          />
        </>
      )}

      <ConfirmDialog
        open={pending?.kind === "ban"}
        onOpenChange={(open) => !open && setPending(null)}
        title="Ban this user?"
        description={
          pending
            ? `${pending.user.email} will be signed out and unable to sign in or create links. You can unban them later.`
            : undefined
        }
        confirmLabel="Ban user"
        onConfirm={() =>
          pending
            ? act({ id: pending.user.id, banned: true }, `${pending.user.email} was banned`)
            : undefined
        }
      />
      <ConfirmDialog
        open={pending?.kind === "delete"}
        onOpenChange={(open) => !open && setPending(null)}
        title="Delete this user?"
        description={
          pending
            ? `This permanently deletes ${pending.user.email} and all ${formatNumber(pending.user.linkCount)} of their links. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete user"
        onConfirm={() => (pending ? removeUser(pending.user) : undefined)}
      />
    </div>
  );
}
