/**
 * Content validator CLI.
 *   npm run validate              # validate packages/content/data
 *   npm run validate -- <dir>     # validate another content directory
 * Exits with code 1 if there are errors (warnings do not fail).
 */
import { readContentDir } from "./load";
import { validateContent, type Issue } from "./validate";

const dir = process.argv[2];
const { raw, issues: readIssues } = readContentDir(dir);
const { bundle, issues: validationIssues } = validateContent(raw);
const issues: Issue[] = [...readIssues, ...validationIssues];

const errors = issues.filter((i) => i.severity === "error");
const warnings = issues.filter((i) => i.severity === "warning");

for (const issue of [...errors, ...warnings]) {
  const tag = issue.severity === "error" ? "ERROR" : "warn ";
  console.log(`${tag}  ${issue.source}${issue.path ? `  ${issue.path}` : ""}: ${issue.message}`);
}

console.log(
  `\n${raw.events.length} events, ${errors.length} errors, ${warnings.length} warnings` +
    (bundle ? ` — content hash ${bundle.hash}` : ""),
);
process.exit(errors.length > 0 ? 1 : 0);
