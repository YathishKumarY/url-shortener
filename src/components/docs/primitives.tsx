import { Fragment } from "react";
import { Hash, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { mono } from "@/components/public/styles";
import { cn } from "@/lib/utils";

/** Building blocks for the developer docs. Server components, no client JS. */

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

const METHOD_TONES: Record<HttpMethod, string> = {
  GET: "bg-green-500/12 text-green-700 ring-green-500/25 dark:text-green-400",
  POST: "bg-blue-500/12 text-blue-700 ring-blue-500/25 dark:text-blue-300",
  PATCH: "bg-amber-500/12 text-amber-700 ring-amber-500/25 dark:text-amber-300",
  DELETE: "bg-red-500/12 text-red-700 ring-red-500/25 dark:text-red-300",
};

export function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span
      className={cn(
        mono,
        "inline-flex h-6 shrink-0 items-center rounded-md px-2 text-[11px] font-bold tracking-wide ring-1 ring-inset",
        METHOD_TONES[method],
      )}
    >
      {method}
    </span>
  );
}

export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code
      className={cn(
        mono,
        "bg-secondary text-foreground rounded-md px-1.5 py-0.5 text-[0.85em] break-words",
      )}
    >
      {children}
    </code>
  );
}

/** A top-level docs section with an anchored, linkable heading. */
export function DocSection({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="border-border/50 scroll-mt-6 border-t pt-12 first:border-t-0 first:pt-0"
    >
      <h2 id={`${id}-title`} className="text-foreground text-2xl font-bold tracking-tight">
        <a
          href={`#${id}`}
          className="group focus-visible:ring-ring/50 inline-flex items-center gap-3 rounded-lg outline-none focus-visible:ring-3"
        >
          <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-xl">
            <Icon className="size-[18px]" aria-hidden />
          </span>
          {title}
          <Hash
            aria-hidden
            className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          />
        </a>
      </h2>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

/** Body copy paragraph. */
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-card-foreground text-[15px] leading-7", className)}>{children}</p>;
}

/** An endpoint: method badge and path as the heading, then its details. */
export function Endpoint({
  id,
  method,
  path,
  summary,
  children,
}: {
  id?: string;
  method: HttpMethod;
  path: string;
  summary: string;
  children?: React.ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-6 space-y-4 pt-4">
      <div>
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          {summary}
        </p>
        <h3 className="mt-1.5 flex flex-wrap items-center gap-2.5">
          <MethodBadge method={method} />
          <code className={cn(mono, "text-foreground text-[15px] font-semibold break-all")}>
            {path}
          </code>
        </h3>
      </div>
      {children}
    </div>
  );
}

/** Smaller heading inside a section ("Response", "Verify signatures"). */
export function SubHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h3 id={id} className="text-foreground scroll-mt-6 pt-2 text-base font-semibold">
      {children}
    </h3>
  );
}

export interface FieldRow {
  name: string;
  type?: string;
  required?: boolean;
  description: React.ReactNode;
}

const TABLE_FRAME = "border-border/60 bg-card/70 shadow-soft rounded-2xl border";

function RequiredBadge() {
  return (
    <span className="rounded-full bg-[#eb568e]/12 px-1.5 py-0.5 text-[10px] font-semibold text-[#c73a72] dark:text-[#f08ab0]">
      required
    </span>
  );
}

/**
 * Name / type / description reference. A real table from `sm` up; on phones
 * the rows stack, since a three-column table would need sideways scrolling.
 */
export function FieldTable({
  rows,
  caption,
  nameHeader = "Name",
  showType = true,
}: {
  rows: FieldRow[];
  caption?: string;
  nameHeader?: string;
  showType?: boolean;
}) {
  return (
    <>
      <ul aria-label={caption} className={cn(TABLE_FRAME, "divide-border/40 divide-y sm:hidden")}>
        {rows.map((row, index) => (
          <li key={`${row.name}-${index}`} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <code className={cn(mono, "text-foreground text-[13px] font-semibold break-all")}>
                {row.name}
              </code>
              {row.required && <RequiredBadge />}
              {showType && row.type && (
                <code className={cn(mono, "text-muted-foreground text-xs break-words")}>
                  {row.type}
                </code>
              )}
            </div>
            <div className="text-card-foreground mt-1 text-sm leading-relaxed">
              {row.description}
            </div>
          </li>
        ))}
      </ul>
      <FieldTableWide rows={rows} caption={caption} nameHeader={nameHeader} showType={showType} />
    </>
  );
}

function FieldTableWide({
  rows,
  caption,
  nameHeader,
  showType,
}: {
  rows: FieldRow[];
  caption?: string;
  nameHeader: string;
  showType: boolean;
}) {
  return (
    <div
      className={cn(
        TABLE_FRAME,
        "focus-visible:ring-ring/50 hidden overflow-x-auto outline-none focus-visible:ring-3 sm:block",
      )}
      tabIndex={0}
      role="region"
      aria-label={caption ?? `${nameHeader} reference`}
    >
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-border/60 bg-secondary/50 border-b">
            <th scope="col" className="text-muted-foreground px-4 py-2.5 text-xs font-semibold">
              {nameHeader}
            </th>
            {showType && (
              <th scope="col" className="text-muted-foreground px-4 py-2.5 text-xs font-semibold">
                Type
              </th>
            )}
            <th scope="col" className="text-muted-foreground px-4 py-2.5 text-xs font-semibold">
              Description
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={`${row.name}-${index}`}
              className="border-border/40 border-b align-top last:border-b-0"
            >
              <th scope="row" className="px-4 py-3 font-normal whitespace-nowrap">
                <code className={cn(mono, "text-foreground text-[13px] font-semibold")}>
                  {row.name}
                </code>
                {row.required && (
                  <span className="ml-2">
                    <RequiredBadge />
                  </span>
                )}
              </th>
              {showType && (
                <td className="px-4 py-3">
                  <code className={cn(mono, "text-muted-foreground text-xs break-words")}>
                    {row.type}
                  </code>
                </td>
              )}
              <td className="text-card-foreground px-4 py-3 leading-relaxed">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Plain table for prose-like rows (rate limits). On phones each row becomes a
 * small card: the first cell as its title, the rest as labelled values.
 */
export function DataTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <>
      <ul aria-label={caption} className={cn(TABLE_FRAME, "divide-border/40 divide-y sm:hidden")}>
        {rows.map(([title, ...values], rowIndex) => (
          <li key={rowIndex} className="px-4 py-3">
            <p className="text-foreground text-sm font-medium">{title}</p>
            <dl className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-sm">
              {values.map((value, index) => (
                <Fragment key={index}>
                  <dt className="text-muted-foreground">{headers[index + 1]}</dt>
                  <dd className="text-card-foreground tabular-nums">{value}</dd>
                </Fragment>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <DataTableWide caption={caption} headers={headers} rows={rows} />
    </>
  );
}

function DataTableWide({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div
      className={cn(
        TABLE_FRAME,
        "focus-visible:ring-ring/50 hidden overflow-x-auto outline-none focus-visible:ring-3 sm:block",
      )}
      tabIndex={0}
      role="region"
      aria-label={caption}
    >
      <table className="w-full min-w-[520px] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-border/60 bg-secondary/50 border-b">
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="text-muted-foreground px-4 py-2.5 text-xs font-semibold"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, rowIndex) => (
            <tr key={rowIndex} className="border-border/40 border-b align-top last:border-b-0">
              {cells.map((cell, cellIndex) =>
                cellIndex === 0 ? (
                  <th key={cellIndex} scope="row" className="text-foreground px-4 py-3 font-medium">
                    {cell}
                  </th>
                ) : (
                  <td key={cellIndex} className="text-card-foreground px-4 py-3 tabular-nums">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CALLOUT_TONES = {
  info: {
    icon: Info,
    className: "border-blue-500/25 bg-blue-500/8 text-blue-900 dark:text-blue-100",
    iconClass: "text-blue-600 dark:text-blue-300",
  },
  warning: {
    icon: TriangleAlert,
    className: "border-amber-500/25 bg-amber-500/8 text-amber-900 dark:text-amber-100",
    iconClass: "text-amber-600 dark:text-amber-300",
  },
} as const;

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: keyof typeof CALLOUT_TONES;
  title?: string;
  children: React.ReactNode;
}) {
  const { icon: Icon, className, iconClass } = CALLOUT_TONES[tone];
  return (
    <div
      role="note"
      className={cn("flex gap-3 rounded-2xl border px-4 py-3.5 text-sm leading-relaxed", className)}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", iconClass)} aria-hidden />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
