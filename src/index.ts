import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { load } from "cheerio"; // <- correct import

const app = express();
const PORT = 3000;

interface TableData {
  headers: string[];
  data: string[][];
}

function parseTradeHistory(): Record<string, TableData> {
  const filePath = path.join(__dirname, "trade_history.html");
  const html = fs.readFileSync(filePath, "utf8");
  const $ = load(html); // <- use load here

  const sections = ["Positions", "Orders", "Deals"];
  const result: Record<string, TableData> = {};

  sections.forEach((section) => {
    const header = $(`th:contains(${section})`);
    if (!header.length) return;

    const tableRows = header.closest("table").find("tr");

    let headers: string[] = [];
    const data: string[][] = [];

    tableRows.each((_, row) => {
      const cells = $(row)
        .find("td, th")
        .map((_, el) => $(el).text().trim())
        .get();

      if (!cells.length) return;

      if (!headers.length && section !== "Deals") {
        headers = cells;
      } else {
        data.push(cells);
      }
    });

    result[section.toLowerCase()] = { headers, data };
  });

  return result;
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
