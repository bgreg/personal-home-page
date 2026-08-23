import { test, expect, coverageEntries } from "./support/battle.js";

const paintOffsets = (entry) => {
  const covered = new Array(entry.source.length).fill(false);
  const ranges = [];

  entry.functions.forEach((fn) => fn.ranges.forEach((range) => ranges.push(range)));
  ranges.sort(
    (a, b) => b.endOffset - b.startOffset - (a.endOffset - a.startOffset)
  );

  ranges.forEach((range) => {
    const end = Math.min(range.endOffset, covered.length);
    for (let offset = range.startOffset; offset < end; offset += 1) {
      covered[offset] = range.count > 0;
    }
  });

  return covered;
};

const mergeRuns = (entries) => {
  const source = entries[0].source;
  const covered = new Array(source.length).fill(false);

  entries.forEach((entry) => {
    paintOffsets(entry).forEach((hit, offset) => {
      if (hit) covered[offset] = true;
    });
  });

  return { source, covered };
};

const lineReport = ({ source, covered }) => {
  const lines = source.split("\n");
  let offset = 0;
  const report = [];

  lines.forEach((text, index) => {
    const start = offset;
    const end = offset + text.length;
    offset = end + 1;

    const code = text.trim();
    if (!code) return;

    let hit = false;
    for (let at = start; at < end; at += 1) {
      if (!/\s/.test(source[at]) && covered[at]) {
        hit = true;
        break;
      }
    }

    report.push({ line: index + 1, hit, text: code });
  });

  return report;
};

const groupMisses = (report) => {
  const groups = [];
  report
    .filter((line) => !line.hit)
    .forEach((line) => {
      const last = groups[groups.length - 1];
      if (last && line.line === last.to + 1) {
        last.to = line.line;
        return;
      }
      groups.push({ from: line.line, to: line.line, text: line.text });
    });
  return groups;
};

test("report how much of the easter egg the suite actually ran", async () => {
  const entries = coverageEntries();
  const byFile = new Map();

  entries.forEach((entry) => {
    const name = entry.url.split("/").slice(-2).join("/");
    if (!byFile.has(name)) byFile.set(name, []);
    byFile.get(name).push(entry);
  });

  expect(entries.length, "no coverage was collected at all").toBeGreaterThan(0);

  const summary = [];

  [...byFile.keys()].sort().forEach((name) => {
    const report = lineReport(mergeRuns(byFile.get(name)));
    const hit = report.filter((line) => line.hit).length;
    const percent = ((hit / report.length) * 100).toFixed(1);

    summary.push(`${name}: ${hit}/${report.length} code lines run (${percent}%)`);
    summary.push(`  runs collected: ${byFile.get(name).length}`);

    const misses = groupMisses(report);
    if (!misses.length) {
      summary.push("  every code line ran");
      return;
    }

    summary.push(`  lines never run (${misses.length} runs of lines):`);
    misses.forEach((group) => {
      const where = group.from === group.to ? `${group.from}` : `${group.from}-${group.to}`;
      summary.push(`    ${where}: ${group.text}`);
    });
  });

  console.log(`\nJavaScript coverage\n${summary.join("\n")}\n`);
});
