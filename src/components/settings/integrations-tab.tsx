"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Download,
  MonitorSmartphone,
  Puzzle,
  Smartphone,
  TerminalSquare,
} from "lucide-react";
import { CodeBlock } from "@/components/settings/code-block";
import { Panel, PanelHeader, pill } from "@/components/shared/ui-kit";
import { downloadText } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export function IntegrationsTab() {
  const [origin, setOrigin] = useState("");
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  const bookmarklet = origin
    ? `javascript:(()=>{window.open('${origin}/dashboard/links/new?url='+encodeURIComponent(location.href),'_blank')})()`
    : "";

  // React refuses javascript: URLs in href props, so set it on the DOM node.
  useEffect(() => {
    if (bookmarklet && bookmarkletRef.current)
      bookmarkletRef.current.setAttribute("href", bookmarklet);
  }, [bookmarklet]);

  const sharex = JSON.stringify(
    {
      Version: "16.0.0",
      Name: "Linkly",
      DestinationType: "URLShortener",
      RequestMethod: "POST",
      RequestURL: `${origin}/api/v1/links`,
      Headers: { Authorization: "Bearer YOUR_API_KEY" },
      Body: "JSON",
      Data: '{"url":"{input}"}',
      URL: "{json:shortUrl}",
      ErrorMessage: "{json:error}",
    },
    null,
    2,
  );

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          icon={Bookmark}
          title="Bookmarklet"
          description="Shorten whatever page you are on, from any browser."
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <a
            ref={bookmarkletRef}
            onClick={(e) => e.preventDefault()}
            draggable
            className={cn(pill.primary, "cursor-grab active:cursor-grabbing")}
          >
            <Bookmark /> Shorten with Linkly
          </a>
          <p className="text-muted-foreground text-sm">
            Drag this button to your bookmarks bar, then click it on any page.
          </p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          icon={Puzzle}
          title="Browser extension"
          description="One click shortens the current tab, right-click shortens any link, with QR codes and auto-copy."
        />
        <ol className="text-card-foreground list-decimal space-y-1.5 pl-5 text-sm">
          <li>
            Find the <code className="bg-secondary rounded px-1.5 py-0.5 text-xs">extension/</code>{" "}
            folder in the Linkly repository.
          </li>
          <li>
            Open{" "}
            <code className="bg-secondary rounded px-1.5 py-0.5 text-xs">chrome://extensions</code>{" "}
            (or edge://extensions), enable Developer mode and choose <b>Load unpacked</b>.
          </li>
          <li>
            Open the extension options, paste this site&apos;s URL and an API key from the API keys
            tab.
          </li>
        </ol>
        <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs">
          <MonitorSmartphone className="size-3.5" /> Works in Chrome, Edge, Brave, Arc and Firefox
          (temporary add-on).
        </p>
      </Panel>

      <Panel>
        <PanelHeader
          icon={Smartphone}
          title="Share from your phone"
          description="Install Linkly as an app, then share any link to it."
        />
        <p className="text-card-foreground text-sm leading-relaxed">
          On Android, open this site in Chrome and choose <b>Install app</b> (or Add to Home
          screen). Linkly then appears in the system share sheet: share a page to it and the link
          builder opens with the URL filled in.
        </p>
      </Panel>

      <Panel>
        <PanelHeader
          icon={TerminalSquare}
          title="ShareX and scripts"
          description="Use Linkly as the URL shortener in ShareX, or from your terminal."
          action={
            <button
              type="button"
              className={cn(pill.secondary, pill.small)}
              disabled={!origin}
              onClick={() => downloadText(sharex, "linkly.sxcu", "application/json")}
            >
              <Download /> ShareX config
            </button>
          }
        />
        <CodeBlock
          label="Shell function"
          code={`shorten() {\n  curl -s "${origin || "https://your-linkly.app"}/api/v1/shorten?format=simple" \\\n    -H "Authorization: Bearer $LINKLY_API_KEY" --get --data-urlencode "url=$1"\n}`}
        />
      </Panel>
    </div>
  );
}
