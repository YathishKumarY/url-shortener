"use client";

import { useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { TagChip, inputClass } from "@/components/shared/ui-kit";
import { useTags } from "@/hooks/use-settings";
import { TAG_DOT_CLASSES } from "@/lib/tag-colors";
import { cn } from "@/lib/utils";

/** Chip-style tag picker with suggestions from the user's existing tags. */
export function TagInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const { data: tags } = useTags();
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const colorOf = (name: string) =>
    tags?.find((t) => t.name.toLowerCase() === name.toLowerCase())?.color ?? "gray";

  const suggestions = useMemo(() => {
    const q = text.trim().toLowerCase();
    return (tags ?? [])
      .filter((t) => !value.some((v) => v.toLowerCase() === t.name.toLowerCase()))
      .filter((t) => !q || t.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [tags, text, value]);

  function add(name: string) {
    const clean = name.trim().slice(0, 40);
    if (!clean || value.some((v) => v.toLowerCase() === clean.toLowerCase()) || value.length >= 20)
      return;
    onChange([...value, clean]);
    setText("");
  }

  const exact = (tags ?? []).some((t) => t.name.toLowerCase() === text.trim().toLowerCase());

  return (
    <div className="relative">
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          inputClass,
          "flex h-auto min-h-10 cursor-text flex-wrap items-center gap-1.5 py-1.5",
        )}
      >
        {value.map((tag) => (
          <TagChip
            key={tag}
            name={tag}
            color={colorOf(tag)}
            onRemove={() => onChange(value.filter((v) => v !== tag))}
          />
        ))}
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={value.length ? "" : "Add tags, press Enter"}
          aria-label="Add tag"
          className="placeholder:text-muted-foreground/70 min-w-[120px] flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {focused && (suggestions.length > 0 || (text.trim() && !exact)) && (
        <div className="border-border bg-popover absolute z-20 mt-1 w-full overflow-hidden rounded-xl border p-1 shadow-xl">
          {text.trim() && !exact && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(text)}
              className="hover:bg-secondary flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm"
            >
              <Plus className="size-3.5" /> Create &ldquo;{text.trim()}&rdquo;
            </button>
          )}
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(tag.name)}
              className="hover:bg-secondary flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm"
            >
              <span
                className={cn("size-2 rounded-full", TAG_DOT_CLASSES[tag.color] ?? "bg-zinc-500")}
              />
              <span className="flex-1 truncate">{tag.name}</span>
              <span className="text-muted-foreground text-xs">{tag.linkCount}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
