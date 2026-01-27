import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

const NOTION_API_BASE = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

function getHeaders() {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    throw new Error("NOTION_API_KEY environment variable is not set");
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

// Helper functions to extract values from Notion properties
type NotionProperty = PageObjectResponse["properties"][string];

export function getTitle(prop: NotionProperty): string {
  if (prop.type === "title") {
    return prop.title.map((t) => t.plain_text).join("");
  }
  return "";
}

export function getRichText(prop: NotionProperty): string {
  if (prop.type === "rich_text") {
    return prop.rich_text.map((t) => t.plain_text).join("");
  }
  return "";
}

export function getNumber(prop: NotionProperty): number {
  if (prop.type === "number") {
    return prop.number ?? 0;
  }
  return 0;
}

export function getSelect(prop: NotionProperty): string {
  if (prop.type === "select") {
    return prop.select?.name ?? "";
  }
  return "";
}

export function getMultiSelect(prop: NotionProperty): string[] {
  if (prop.type === "multi_select") {
    return prop.multi_select.map((s) => s.name);
  }
  return [];
}

export function getCheckbox(prop: NotionProperty): boolean {
  if (prop.type === "checkbox") {
    return prop.checkbox;
  }
  return false;
}

export function getFiles(prop: NotionProperty): string[] {
  if (prop.type === "files") {
    return prop.files
      .map((f) => {
        if (f.type === "file") {
          return f.file.url;
        } else if (f.type === "external") {
          return f.external.url;
        }
        return "";
      })
      .filter(Boolean);
  }
  return [];
}

interface QueryDatabaseResponse {
  results: PageObjectResponse[];
  next_cursor: string | null;
  has_more: boolean;
}

// Query all pages from a database (handles pagination)
export async function queryAllPages(
  databaseId: string
): Promise<PageObjectResponse[]> {
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined = undefined;

  do {
    const body: Record<string, unknown> = {};
    if (cursor) {
      body.start_cursor = cursor;
    }

    const response = await fetch(
      `${NOTION_API_BASE}/databases/${databaseId}/query`,
      {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Notion API error: ${response.status} - ${error}`);
    }

    const data: QueryDatabaseResponse = await response.json();

    for (const page of data.results) {
      if ("properties" in page) {
        pages.push(page);
      }
    }

    cursor = data.next_cursor ?? undefined;
  } while (cursor);

  return pages;
}
