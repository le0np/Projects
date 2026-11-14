/** Reads content files from disk. Kept separate from validation so tests can use in-memory data. */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { validateContent, type ContentBundle, type Issue, type RawContent, type RawFile } from "./validate";

/** Default location of the authored content shipped with this package. */
export const DEFAULT_CONTENT_DIR = fileURLToPath(new URL("../data", import.meta.url));

export function readContentDir(dir: string = DEFAULT_CONTENT_DIR): { raw: RawContent; issues: Issue[] } {
  const issues: Issue[] = [];
  const read = (path: string): RawFile => {
    const file = relative(dir, path);
    try {
      return { file, data: JSON.parse(readFileSync(path, "utf8")) };
    } catch (err) {
      issues.push({ severity: "error", source: file, path: "", message: `cannot read JSON: ${(err as Error).message}` });
      return { file, data: undefined };
    }
  };
  const eventsDir = join(dir, "events");
  const eventFiles = readdirSync(eventsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  return {
    raw: {
      careers: read(join(dir, "careers.json")),
      facts: read(join(dir, "facts.json")),
      map: read(join(dir, "map.json")),
      // Unreadable files are already reported above; don't report them again as schema errors.
      events: eventFiles.map((f) => read(join(eventsDir, f))).filter((e) => e.data !== undefined),
    },
    issues,
  };
}

/** Loads and validates content; throws if there is any error. Used by the engine and simulator. */
export function loadContent(dir: string = DEFAULT_CONTENT_DIR): ContentBundle {
  const { raw, issues: readIssues } = readContentDir(dir);
  const { bundle, issues } = validateContent(raw);
  const errors = [...readIssues, ...issues].filter((i) => i.severity === "error");
  if (errors.length > 0 || !bundle) {
    const lines = errors.slice(0, 10).map((e) => `  ${e.source} ${e.path}: ${e.message}`);
    throw new Error(`Content is invalid (${errors.length} errors):\n${lines.join("\n")}`);
  }
  return bundle;
}
