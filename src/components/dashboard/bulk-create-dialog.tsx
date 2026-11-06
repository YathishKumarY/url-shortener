"use client";

import { useState } from "react";
import { CheckCircle2, Copy, FileUp, Layers, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Field, inputClass, pill } from "@/components/shared/ui-kit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useBulkCreate, useImportLinks, type BulkResponse } from "@/hooks/use-links";
import { useInstanceConfig } from "@/hooks/use-settings";
import { downloadText } from "@/lib/api-client";
import { cn, copyToClipboard } from "@/lib/utils";

/** "https://a.com, my-alias" per line -> payload rows. */
function parseLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [url, alias] = line.split(/[\s,]+/, 2);
      const normalized = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
      return { url: normalized, ...(alias ? { customAlias: alias } : {}) };
    });
}

function Results({ result, inputs }: { result: BulkResponse; inputs: string[] }) {
  const created = result.results.filter((r) => r.ok && r.link);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-foreground text-sm">
          <span className="font-semibold text-green-600 dark:text-green-400">
            {result.created} created
          </span>
          {result.failed > 0 && (
            <span className="text-destructive font-semibold">, {result.failed} failed</span>
          )}
        </p>
        {created.length > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              className={cn(pill.secondary, pill.small)}
              onClick={async () => {
                await copyToClipboard(created.map((r) => r.link!.shortUrl).join("\n"));
                toast.success("Copied all short links");
              }}
            >
              <Copy /> Copy all
            </button>
            <button
              type="button"
              className={cn(pill.secondary, pill.small)}
              onClick={() =>
                downloadText(
                  [
                    "original,short",
                    ...created.map((r) => `${r.link!.originalUrl},${r.link!.shortUrl}`),
                  ].join("\n"),
                  "short-links.csv",
                  "text/csv",
                )
              }
            >
              CSV
            </button>
          </div>
        )}
      </div>
      <ul className="border-border divide-border/60 max-h-72 divide-y overflow-y-auto rounded-xl border">
        {result.results.map((row) => (
          <li key={row.index} className="flex items-start gap-2.5 px-3 py-2 text-xs">
            {row.ok ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-green-500" />
            ) : (
              <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-muted-foreground truncate">
                {row.link?.originalUrl ?? inputs[row.index] ?? `Row ${row.index + 1}`}
              </p>
              {row.ok ? (
                <p className="text-primary truncate font-medium">{row.link?.displayUrl}</p>
              ) : (
                <p className="text-destructive">{row.error}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BulkCreateDialog() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"paste" | "csv">("paste");
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [result, setResult] = useState<BulkResponse | null>(null);
  const [inputs, setInputs] = useState<string[]>([]);
  const bulkCreate = useBulkCreate();
  const importLinks = useImportLinks();
  const { data: config } = useInstanceConfig();
  const limit = config?.bulkLimit ?? 100;
  const pending = bulkCreate.isPending || importLinks.isPending;
  const lineCount = mode === "paste" ? parseLines(text).length : 0;

  function reset() {
    setText("");
    setTags("");
    setResult(null);
    setInputs([]);
  }

  async function submit() {
    try {
      if (mode === "paste") {
        const links = parseLines(text);
        if (links.length === 0) return;
        if (links.length > limit) {
          toast.error(`At most ${limit} links at a time`);
          return;
        }
        setInputs(links.map((l) => l.url));
        const tagList = tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        setResult(await bulkCreate.mutateAsync({ links, tags: tagList }));
      } else {
        setInputs([]);
        setResult(await importLinks.mutateAsync(text));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk create failed");
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2_000_000) {
      toast.error("CSV files up to 2 MB, please");
      return;
    }
    setText(await file.text());
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger className={pill.secondary}>
        <Layers /> Bulk
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create links in bulk</DialogTitle>
          <DialogDescription>
            Paste up to {limit} URLs, or import a CSV exported from Bitly, Dub, Short.io or Linkly.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <>
            <Results result={result} inputs={inputs} />
            <div className="flex justify-end gap-2">
              <button type="button" className={cn(pill.secondary, pill.small)} onClick={reset}>
                Add more
              </button>
              <button
                type="button"
                className={cn(pill.primary, pill.small)}
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-secondary inline-flex w-fit gap-1 rounded-full p-1">
              {(["paste", "csv"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setText("");
                  }}
                  className={cn(
                    "h-8 cursor-pointer rounded-full px-4 text-[13px] font-medium transition-colors",
                    mode === m
                      ? "bg-primary text-white"
                      : "text-card-foreground hover:text-foreground",
                  )}
                >
                  {m === "paste" ? "Paste URLs" : "Import CSV"}
                </button>
              ))}
            </div>

            {mode === "paste" ? (
              <>
                <Field
                  label="URLs"
                  hint={`One per line. Add an alias after a comma: https://example.com, summer-sale${lineCount ? ` - ${lineCount} detected` : ""}`}
                >
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={8}
                    placeholder={
                      "https://example.com/very/long/page\nhttps://github.com/your/repo, repo\nexample.org/pricing"
                    }
                    className={cn(inputClass, "h-auto resize-y py-2.5 font-mono text-[13px]")}
                  />
                </Field>
                <Field label="Tags for all links" hint="Optional, comma separated">
                  <input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="campaign, newsletter"
                    className={inputClass}
                  />
                </Field>
              </>
            ) : (
              <div className="space-y-3">
                <label className="border-border hover:border-primary/60 hover:bg-primary/5 flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-center transition-colors">
                  <FileUp className="text-primary size-7" />
                  <span className="text-foreground text-sm font-medium">Choose a CSV file</span>
                  <span className="text-muted-foreground text-xs">
                    Needs a <code>url</code> column; optional <code>alias</code>, <code>title</code>
                    , <code>tags</code> (separated by |), <code>expiresAt</code>
                  </span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="sr-only"
                    onChange={(e) => onFile(e.target.files?.[0])}
                  />
                </label>
                {text && (
                  <p className="text-muted-foreground text-xs">
                    Loaded {Math.max(0, text.trim().split(/\r?\n/).length - 1)} data rows.
                  </p>
                )}
              </div>
            )}

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
                className={cn(pill.primary, pill.small)}
                disabled={pending || !text.trim()}
                onClick={submit}
              >
                {pending && <Loader2 className="animate-spin" />}
                {mode === "paste"
                  ? `Shorten ${lineCount || ""} link${lineCount === 1 ? "" : "s"}`
                  : "Import"}
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
