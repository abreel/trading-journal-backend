import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { load } from "cheerio"; // <- correct import

const app = express();
const PORT = 4000;
interface TradeHistory {
  Positions: Record<string, string>[];
  Orders: Record<string, string>[];
  Deals: Record<string, string>[];
  Summary: Record<string, string>;
}

function parseTradeHistory(): TradeHistory {
  const filePath = path.join(__dirname, "example.html");
  const html = fs.readFileSync(filePath, "utf8");
  const $ = load(html);

  const results: TradeHistory = {
    Positions: [],
    Orders: [],
    Deals: [],
    Summary: {},
  };

  let currentSection: keyof TradeHistory | null = null;
  let currentHeaders: string[] = [];

  $("tr").each((_, row) => {
    const sectionTitle = $(row).find("th div b").text().trim();

    // Detect new section
    if (sectionTitle && ["Positions", "Orders", "Deals"].includes(sectionTitle)) {
      currentSection = sectionTitle as keyof TradeHistory;
      currentHeaders = [];
      return;
    }

    // Detect header row
    if ($(row).find("td b").length && currentSection && currentSection !== "Summary") {
      currentHeaders = [];
      $(row)
        .find("td, th")
        .each((_, el) => {
          const text = $(el).text().trim();
          const colspan = parseInt($(el).attr("colspan") || "1", 10);

          for (let i = 0; i < colspan; i++) {
            currentHeaders.push(text || "");
          }
        });
      return;
    }

    // Data rows
    if (currentSection && currentHeaders.length && currentSection !== "Summary") {
      const cells: string[] = [];
      $(row)
        .find("td")
        .each((_, el) => {
          if ($(el).hasClass("hidden")) return; // skip hidden cells

          const text = $(el).text().trim();
          const colspan = parseInt($(el).attr("colspan") || "1", 10);

          for (let i = 0; i < colspan; i++) {
            cells.push(text || "");
          }
        });

      if (cells.length) {
        const rowData: Record<string, string> = {};
        currentHeaders.forEach((header, i) => {
          rowData[header] = cells[i] ?? "";
        });
        results[currentSection].push(rowData);
      }
      return;
    }

    // Detect summary section
    if (!sectionTitle && currentSection !== "Summary" && $(row).text().includes("Balance:")) {
      currentSection = "Summary";
    }

    // Parse summary
    if (currentSection === "Summary") {
      const cells = $(row)
        .find("td")
        .map((_, el) => $(el).text().trim())
        .get()
        .filter((t) => t !== "");

      for (let i = 0; i < cells.length; i += 2) {
        const key = cells[i];
        const value = cells[i + 1];
        if (key && key.endsWith(":") && value !== undefined) {
          results.Summary[key.replace(/:$/, "")] = value;
        }
      }
    }
  });

  return results;
}

app.get("/trade-history", (req: Request, res: Response) => {
  try {
    const tradeData = parseTradeHistory();
    res.json(tradeData);
  } catch (err: unknown) {
    if (err instanceof Error) {
      res.status(500).json({ error: err.message });
    } else {
      res.status(500).json({ error: "Unknown error occurred" });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
