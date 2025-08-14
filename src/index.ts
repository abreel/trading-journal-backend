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
  // Summary: Record<string, string>;
}

function parseTradeHistory(): TradeHistory {
  const filePath = path.join(__dirname, "example.html");
  const html = fs.readFileSync(filePath, "utf8");
  const $ = load(html);

  const results: TradeHistory = {
    Positions: [],
    Orders: [],
    Deals: [],
    // Summary: {},
  };

  let currentSection: keyof TradeHistory | null = null;
  let currentHeaders: string[] = [];

  $("tr").each((_, row) => {
    const sectionTitle = $(row).find("th div b").text().trim();

    // Start a new section
    if (sectionTitle) {
      if (["Positions", "Orders", "Deals"].includes(sectionTitle)) {
        currentSection = sectionTitle as keyof TradeHistory;
        currentHeaders = [];
      } else {
        // Any other section title = exit current section
        currentSection = null;
      }
      return;
    }

    // Section header row
    if (currentSection && $(row).find("td b, th b").length) {
      currentHeaders = [];
      $(row)
        .find("td, th")
        .each((_, el) => {
          if ($(el).hasClass("hidden")) return; // skip hidden headers
          const text = $(el).text().trim();
          const colspan = parseInt($(el).attr("colspan") || "1", 10);
          for (let i = 0; i < colspan; i++) {
            currentHeaders.push(text || "");
          }
        });
      return;
    }

    // Data rows
    if (currentSection && currentHeaders.length) {
      const cells: string[] = [];
      $(row)
        .find("td")
        .each((_, el) => {
          if ($(el).hasClass("hidden")) return;
          const text = $(el).text().trim();
          const colspan = parseInt($(el).attr("colspan") || "1", 10);
          for (let i = 0; i < colspan; i++) {
            cells.push(text || "");
          }
        });

      // Skip totals row
      const isTotalsRow = cells.every((c) => c === "" || /^-?\d[\d\s.,%()-]*$/.test(c));

      if (isTotalsRow) return;

      if (cells.length) {
        const rowData: Record<string, string> = {};
        currentHeaders.forEach((header, i) => {
          rowData[header] = cells[i] ?? "";
        });
        results[currentSection].push(rowData);
      }
      return;
    }

    // If we get here and we're in a section, but the row doesn't match, end section
    if (currentSection && !$(row).find("td").length) {
      currentSection = null;
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

app.get("/", (req, res) => {
  res.send(`
    <html>
    <head>
      <title>Trade History Viewer</title>
    </head>
    <body>
      <h1>Trade History</h1>
      <div id="app">Loading...</div>
      <script>
        fetch('/trade-history')
          .then(res => res.json())
          .then(data => {
            document.getElementById('app').innerHTML = JSON.stringify(data, null, 2);
          })
          .catch(err => {
            document.getElementById('app').innerHTML = 'Error: ' + err;
          });
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
