export class ReportPrinter {
  printSection(title, items) {
    console.log(`\n-- ${title} --`);
    if (!items?.length) {
      console.log("  No data.");
      return;
    }
    items.forEach((item) => console.log(`  - ${item}`));
  }

  printRaw(result) {
    console.log("=== RAW DATA ===");
    console.log(JSON.stringify(result, null, 2));
  }

  printSummary(summary) {
    console.log("\n=== MARKET REPORT ===");
    this.printSection("1. Market Snapshot", summary.market_snapshot);
    this.printSection("2. Current Position", summary.current_position);
    this.printSection("3. Where to Focus", summary.improvements);
    this.printSection("4. Estimation", summary.estimation);
  }
}
