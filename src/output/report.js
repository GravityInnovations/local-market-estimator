export class MarketReportOutput {
  buildSection(title, items) {
    const lines = [`\n-- ${title} --`];

    if (!items?.length) {
      lines.push("  No data.");
      return lines.join("\n");
    }

    items.forEach((item) => lines.push(`  - ${item}`));
    return lines.join("\n");
  }

  buildRaw(result) {
    return `=== RAW DATA ===\n${JSON.stringify(result, null, 2)}`;
  }

  buildSummary(summary) {
    return [
      "=== MARKET REPORT ===",
      this.buildSection("1. Market Snapshot", summary.market_snapshot),
      this.buildSection("2. Current Position", summary.current_position),
      this.buildSection("3. Where to Focus", summary.improvements),
      this.buildSection("4. Estimation", summary.estimation),
    ].join("\n");
  }

  create({ result, summary }) {
    return {
      rawText: this.buildRaw(result),
      summaryText: summary ? this.buildSummary(summary) : null,
      verboseText: [this.buildRaw(result), summary ? this.buildSummary(summary) : null]
        .filter(Boolean)
        .join("\n\n"),
    };
  }
}

export default MarketReportOutput;