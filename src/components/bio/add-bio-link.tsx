"use client";

import { useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { normalizeLinkInput } from "@/components/bio/utils";
import { inputClass, pill } from "@/components/shared/ui-kit";
import type { BioLinkItem, BioResponse } from "@/hooks/use-bio";
import { useCreateLink } from "@/hooks/use-links";
import { ApiError } from "@/lib/api-client";

/**
 * Put any URL on the bio page without leaving the editor: a resume on Google
 * Drive, a portfolio, a LeetCode profile. It becomes an ordinary short link,
 * so its clicks show up in analytics like every other link.
 *
 * Lives inside the editor's <form>, so it is a plain group of fields (forms
 * cannot nest) and Enter is handled here instead of submitting the page.
 */
export function AddBioLink({
  disabled,
  onAdded,
}: {
  disabled?: boolean;
  /** Called with the new link once it exists; the caller features it. */
  onAdded: (link: BioLinkItem) => void;
}) {
  const id = useId();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const urlInput = useRef<HTMLInputElement>(null);
  const createLink = useCreateLink();
  const queryClient = useQueryClient();

  async function add() {
    const destination = normalizeLinkInput(url);
    if (!destination) {
      setError("Paste the link you want to add");
      urlInput.current?.focus();
      return;
    }
    setError("");
    try {
      const created = await createLink.mutateAsync({
        url: destination,
        title: title.trim() || undefined,
      });
      const item: BioLinkItem = {
        id: created.id,
        shortCode: created.shortCode,
        domain: created.domain ?? "",
        title: created.title,
        originalUrl: created.originalUrl,
        bioPinned: false,
        bioPosition: 0,
        clickCount: created.clickCount,
      };
      // Show it right away; the next fetch of /api/bio returns it too.
      queryClient.setQueryData<BioResponse>(["bio"], (current) =>
        current ? { ...current, links: [item, ...current.links] } : current,
      );
      onAdded(item);
      setUrl("");
      setTitle("");
      urlInput.current?.focus();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not add the link. Try again.");
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    // Inside the editor form: Enter adds the link instead of saving the page.
    event.preventDefault();
    if (!createLink.isPending) void add();
  }

  const busy = createLink.isPending;
  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      className="bg-secondary/40 rounded-xl p-3 shadow-[0_0_0_1px_var(--border)]"
    >
      <p id={`${id}-label`} className="text-card-foreground mb-2 px-0.5 text-[13px] font-semibold">
        Add a link
      </p>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
        <input
          ref={urlInput}
          type="text"
          inputMode="url"
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            if (error) setError("");
          }}
          onKeyDown={onKeyDown}
          placeholder="Paste any URL, e.g. your resume"
          aria-label="Link URL"
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={disabled || busy}
          className={inputClass}
        />
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Button text (optional)"
          aria-label="Button text"
          maxLength={200}
          disabled={disabled || busy}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => void add()}
          disabled={disabled || busy}
          className={pill.primary}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Plus />}
          Add
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-destructive mt-2 px-0.5 text-xs">
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-muted-foreground mt-2 px-0.5 text-xs">
          {disabled
            ? "Your page is full. Remove a link to add another."
            : "Goes to the end of your page as a tracked short link. Save to publish it."}
        </p>
      )}
    </div>
  );
}
