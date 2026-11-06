"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BioSocials } from "@/components/bio/socials";
import type { BioThemeId } from "@/components/bio/themes";
import { apiFetch } from "@/lib/api-client";

/** The caller's bio page as returned by the API (dates are ISO strings). */
export interface BioPageData {
  id: string;
  userId: string;
  slug: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  theme: string;
  /** Untyped JSON column; read it through `parseSocials`. */
  socials: unknown;
  published: boolean;
  views: number;
  createdAt: string;
  updatedAt: string;
}

/** A link the owner can feature, featured ones first in display order. */
export interface BioLinkItem {
  id: string;
  shortCode: string;
  /** Custom domain hostname, or "" for the app's own domain. */
  domain: string;
  title: string | null;
  originalUrl: string;
  bioPinned: boolean;
  bioPosition: number;
  clickCount: number;
}

export interface BioResponse {
  page: BioPageData | null;
  links: BioLinkItem[];
}

/** Body of PUT /api/bio. */
export interface SaveBioInput {
  slug: string;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  theme: BioThemeId;
  socials?: BioSocials | null;
  published: boolean;
  /** Ordered ids of the links to feature; every other link is un-featured. */
  links?: string[];
}

export function useBio() {
  return useQuery<BioResponse>({
    queryKey: ["bio"],
    queryFn: () => apiFetch<BioResponse>("/api/bio"),
  });
}

export function useSaveBio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveBioInput) =>
      apiFetch<BioPageData>("/api/bio", { method: "PUT", json: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bio"] });
      // Featuring changes each link's bioPinned flag.
      queryClient.invalidateQueries({ queryKey: ["links"] });
    },
  });
}
