import { config } from "@/lib/config";
import { BULK_ACTIONS, LINK_STATUSES, STATS_PERIODS, TAG_COLORS } from "@/lib/validators";

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ "application/json": { schema } });
const errors = {
  "400": { description: "Validation error", content: json(ref("Error")) },
  "401": { description: "Missing or invalid API key", content: json(ref("Error")) },
  "429": { description: "Rate limited", content: json(ref("Error")) },
};
const idParam = { name: "id", in: "path", required: true, schema: { type: "string" } };

const nullableString = { type: ["string", "null"] };
const nullableUrl = { type: ["string", "null"], format: "uri" };

/** OpenAPI 3.1 description of the public v1 API. */
export function buildOpenApiSpec(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: `${config.siteName} API`,
      version: "1.0.0",
      description:
        "Create and manage short links, read analytics, and organise links with tags. Authenticate with an API key from Settings > API keys, sent as `Authorization: Bearer lk_...`.",
    },
    servers: [{ url: `${origin}/api/v1` }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "API key (lk_...)" },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            fieldErrors: {
              type: "object",
              additionalProperties: { type: "array", items: { type: "string" } },
            },
          },
        },
        Tag: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            color: { type: "string", enum: [...TAG_COLORS] },
          },
        },
        Variant: {
          type: "object",
          required: ["url", "weight"],
          properties: {
            url: { type: "string", format: "uri" },
            weight: { type: "integer", minimum: 1, maximum: 100 },
          },
        },
        LinkInput: {
          type: "object",
          required: ["url"],
          properties: {
            url: { type: "string", format: "uri", description: "Destination (http/https only)" },
            customAlias: {
              type: "string",
              description: "Custom back-half; letters, numbers, emoji, - and _",
            },
            emoji: {
              type: "boolean",
              description: "Generate an emoji code instead of an alphanumeric one",
            },
            domain: {
              type: "string",
              description: "Verified custom domain to use (omit for the default domain)",
            },
            title: nullableString,
            description: { ...nullableString, description: "Private notes" },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Tag names; created if missing",
            },
            password: { ...nullableString, description: "Visitors must enter this to continue" },
            expiresAt: { type: ["string", "null"], format: "date-time" },
            expiredUrl: {
              ...nullableUrl,
              description: "Where to send visitors after expiry or the click limit",
            },
            startsAt: {
              type: ["string", "null"],
              format: "date-time",
              description: "Link activates at this time",
            },
            maxClicks: { type: ["integer", "null"], minimum: 1 },
            disabled: { type: "boolean" },
            archived: { type: "boolean" },
            redirectType: { type: "integer", enum: [301, 302, 307, 308] },
            forwardQuery: {
              type: "boolean",
              description: "Append the visitor's query string to the destination",
            },
            hideReferrer: { type: "boolean" },
            cloaked: { type: "boolean", description: "Frame the destination under the short URL" },
            noLog: {
              type: "boolean",
              description: "Privacy mode: count clicks but store no visitor details",
            },
            iosUrl: nullableUrl,
            androidUrl: nullableUrl,
            geoTargets: {
              type: ["object", "null"],
              additionalProperties: { type: "string", format: "uri" },
              description: "Map of ISO country code to destination",
            },
            abVariants: {
              type: ["array", "null"],
              items: ref("Variant"),
              minItems: 2,
              maxItems: 5,
            },
            ogTitle: nullableString,
            ogDescription: nullableString,
            ogImage: nullableUrl,
            publicStats: { type: "boolean" },
          },
        },
        Link: {
          type: "object",
          properties: {
            id: { type: "string" },
            shortCode: { type: "string" },
            shortUrl: { type: "string", format: "uri" },
            domain: nullableString,
            originalUrl: { type: "string", format: "uri" },
            title: nullableString,
            status: {
              type: "string",
              enum: ["active", "expired", "limited", "scheduled", "disabled", "banned"],
            },
            hasPassword: { type: "boolean" },
            clickCount: { type: "integer" },
            tags: { type: "array", items: ref("Tag") },
            createdAt: { type: "string", format: "date-time" },
            expiresAt: { type: ["string", "null"], format: "date-time" },
            maxClicks: { type: ["integer", "null"] },
          },
          additionalProperties: true,
        },
        Breakdown: {
          type: "object",
          properties: {
            key: { type: "string" },
            clicks: { type: "integer" },
            uniques: { type: "integer" },
          },
        },
        Stats: {
          type: "object",
          properties: {
            totals: {
              type: "object",
              properties: {
                clicks: { type: "integer" },
                uniques: { type: "integer" },
                bots: { type: "integer" },
                qrScans: { type: "integer" },
              },
            },
            timeseries: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  bucket: { type: "string" },
                  clicks: { type: "integer" },
                  uniques: { type: "integer" },
                },
              },
            },
            referrers: { type: "array", items: ref("Breakdown") },
            countries: { type: "array", items: ref("Breakdown") },
            devices: { type: "array", items: ref("Breakdown") },
            browsers: { type: "array", items: ref("Breakdown") },
            os: { type: "array", items: ref("Breakdown") },
          },
          additionalProperties: true,
        },
      },
    },
    paths: {
      "/shorten": {
        get: {
          summary: "Shorten a URL in one call",
          description:
            "Works without a key unless the instance disables anonymous links. `format=simple` returns plain text.",
          security: [{}, { bearerAuth: [] }],
          parameters: [
            { name: "url", in: "query", required: true, schema: { type: "string", format: "uri" } },
            { name: "alias", in: "query", schema: { type: "string" } },
            { name: "format", in: "query", schema: { type: "string", enum: ["json", "simple"] } },
          ],
          responses: {
            "201": {
              description: "Created",
              content: { ...json(ref("Link")), "text/plain": { schema: { type: "string" } } },
            },
            ...errors,
          },
        },
      },
      "/links": {
        get: {
          summary: "List links",
          parameters: [
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } },
            { name: "search", in: "query", schema: { type: "string" } },
            { name: "status", in: "query", schema: { type: "string", enum: [...LINK_STATUSES] } },
            { name: "tag", in: "query", schema: { type: "string" }, description: "Tag id" },
            {
              name: "sort",
              in: "query",
              schema: { type: "string", enum: ["createdAt", "clicks", "lastClickedAt", "title"] },
            },
            { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
          ],
          responses: {
            "200": {
              description: "A page of links",
              content: json({
                type: "object",
                properties: {
                  links: { type: "array", items: ref("Link") },
                  total: { type: "integer" },
                  page: { type: "integer" },
                  totalPages: { type: "integer" },
                },
              }),
            },
            ...errors,
          },
        },
        post: {
          summary: "Create a link",
          requestBody: { required: true, content: json(ref("LinkInput")) },
          responses: {
            "201": { description: "Created", content: json(ref("Link")) },
            "409": { description: "Alias taken", content: json(ref("Error")) },
            ...errors,
          },
        },
      },
      "/links/{id}": {
        parameters: [idParam],
        get: {
          summary: "Get a link",
          responses: { "200": { description: "The link", content: json(ref("Link")) }, ...errors },
        },
        patch: {
          summary: "Update a link",
          description: "Send only the fields to change. `null` clears an optional field.",
          requestBody: { required: true, content: json(ref("LinkInput")) },
          responses: { "200": { description: "Updated", content: json(ref("Link")) }, ...errors },
        },
        delete: {
          summary: "Delete a link",
          responses: { "204": { description: "Deleted" }, ...errors },
        },
      },
      "/links/{id}/stats": {
        parameters: [
          idParam,
          {
            name: "period",
            in: "query",
            schema: { type: "string", enum: [...STATS_PERIODS], default: "7d" },
          },
          {
            name: "tz",
            in: "query",
            schema: { type: "string" },
            description: "IANA timezone, e.g. Europe/Berlin",
          },
        ],
        get: {
          summary: "Link analytics",
          responses: { "200": { description: "Stats", content: json(ref("Stats")) }, ...errors },
        },
      },
      "/links/bulk": {
        post: {
          summary: "Create many links",
          requestBody: {
            required: true,
            content: json({
              type: "object",
              properties: {
                links: { type: "array", items: ref("LinkInput") },
                tags: { type: "array", items: { type: "string" } },
              },
            }),
          },
          responses: { "201": { description: "Per-row results" }, ...errors },
        },
        patch: {
          summary: "Apply an action to many links",
          requestBody: {
            required: true,
            content: json({
              type: "object",
              required: ["ids", "action"],
              properties: {
                ids: { type: "array", items: { type: "string" } },
                action: { type: "string", enum: [...BULK_ACTIONS] },
                tag: { type: "string" },
              },
            }),
          },
          responses: { "200": { description: "Done" }, ...errors },
        },
      },
      "/stats": {
        get: {
          summary: "Account-wide analytics",
          parameters: [
            { name: "period", in: "query", schema: { type: "string", enum: [...STATS_PERIODS] } },
          ],
          responses: { "200": { description: "Stats", content: json(ref("Stats")) }, ...errors },
        },
      },
      "/tags": {
        get: {
          summary: "List tags",
          responses: {
            "200": { description: "Tags", content: json({ type: "array", items: ref("Tag") }) },
            ...errors,
          },
        },
        post: {
          summary: "Create a tag",
          requestBody: {
            required: true,
            content: json({
              type: "object",
              required: ["name"],
              properties: {
                name: { type: "string" },
                color: { type: "string", enum: [...TAG_COLORS] },
              },
            }),
          },
          responses: { "201": { description: "Created", content: json(ref("Tag")) }, ...errors },
        },
      },
    },
  };
}
