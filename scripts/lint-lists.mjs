#!/usr/bin/env node
// OS-agnostic (Windows/Linux/macOS) formatter/linter for the list data files.
// Checks and fixes, per .editorconfig: LF endings, no trailing whitespace,
// exactly one final newline, no UTF-8 BOM.
//
// Usage:
//   node scripts/lint-lists.mjs          check mode (exit 1 on issues)
//   node scripts/lint-lists.mjs --fix    fix issues in place
//   node scripts/lint-lists.mjs --fix allowlist/custom blocklist/external
//                                        check/fix only the given paths

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";

const DEFAULT_TARGETS = ["allowlist", "blocklist"];
const DATA_EXTENSIONS = new Set([".txt", ".list", ".hosts"]);

const args = process.argv.slice(2);
const fix = args.includes("--fix");
const targets = args
  .filter((arg) => !arg.startsWith("--"))
  .map((arg) => resolve(arg));

if (targets.length === 0) {
  targets.push(...DEFAULT_TARGETS.map((dir) => resolve(dir)));
}

const problems = [];
let filesChecked = 0;
let filesFixed = 0;

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    problems.push(`${dir}: cannot read directory`);
    return;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (DATA_EXTENSIONS.has(ext(entry.name))) {
      checkFile(fullPath);
    }
  }
}

function ext(name) {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx).toLowerCase();
}

function checkFile(path) {
  filesChecked++;
  const raw = readFileSync(path);
  const issues = [];

  const hasBom =
    raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
  if (hasBom) {
    issues.push("UTF-8 BOM");
  }

  const text = raw.toString("utf8");
  const endsWithNewline = text.length === 0 || text.endsWith("\n");
  if (text.length > 0 && !endsWithNewline) {
    issues.push("missing final newline");
  }

  const crlfLines = [];
  const trailingLines = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.endsWith("\r")) {
      crlfLines.push(i + 1);
    }
    const content = line.replace(/\r$/, "");
    if (content.length > 0 && /[ \t]+$/.test(content)) {
      trailingLines.push(i + 1);
    }
  }

  if (crlfLines.length > 0) {
    issues.push(`CRLF line endings on line(s) ${summarize(crlfLines)}`);
  }
  if (trailingLines.length > 0) {
    issues.push(`trailing whitespace on line(s) ${summarize(trailingLines)}`);
  }

  if (issues.length === 0) {
    return;
  }

  if (fix) {
    let fixed = hasBom ? text.replace(/^\uFEFF/, "") : text;
    fixed = fixed.replace(/\r\n?/g, "\n");
    if (fixed.length > 0 && !fixed.endsWith("\n")) {
      fixed += "\n";
    }
    fixed = fixed.replace(/[ \t]+\n/g, "\n");
    writeFileSync(path, fixed, "utf8");
    filesFixed++;
    console.log(`fixed ${display(path)}: ${issues.join("; ")}`);
  } else {
    problems.push(`${display(path)}: ${issues.join("; ")}`);
  }
}

function summarize(lineNumbers) {
  const head = lineNumbers.slice(0, 5).join(", ");
  return lineNumbers.length > 5 ? `${head}, ...` : head;
}

function display(path) {
  const cwd = resolve(process.cwd()) + sep;
  const rel = resolve(path).startsWith(cwd)
    ? resolve(path).slice(cwd.length)
    : resolve(path);
  return rel.split(sep).join("/");
}

for (const target of targets) {
  const st = statSync(target, { throwIfNoEntry: false });
  if (!st) {
    problems.push(`${target}: no such file or directory`);
    continue;
  }
  if (st.isDirectory()) {
    walk(target);
  } else if (DATA_EXTENSIONS.has(ext(target))) {
    checkFile(target);
  }
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(problem);
  }
  console.error(
    `\n${problems.length} file(s) with issues (checked ${filesChecked}). Run "npm run lint:fix" to fix them automatically.`,
  );
  process.exit(1);
}

console.log(
  `OK: ${filesChecked} data file(s) checked${fix ? `, ${filesFixed} fixed` : ""}.`,
);
