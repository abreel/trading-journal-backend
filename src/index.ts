import express from "express";
import path from "path";
import XLSX from "xlsx";
import cors from "cors";

const app = express();
const PORT = 4000;
app.use(
  cors({
    origin: "https://fantastic-fortnight-j9jw5qr475phqxvx-3000.app.github.dev", // your frontend origin
    methods: ["GET", "POST"],
    credentials: true,
  }),
);

interface TradeHistory {
  Positions: Record<string, string>[];
  Orders: Record<string, string>[];
  Deals: Record<string, string>[];
}

function parseTradeHistory(): TradeHistory {
  const filePath = path.join(__dirname, "trades.xlsx");
  const workbook = XLSX.readFile(filePath);

  const results: TradeHistory = {
    Positions: [],
    Orders: [],
    Deals: [],
  };

  // Loop through all sheets (or pick the first one)
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
    });

    // Detect section by a header row
    let currentSection: keyof TradeHistory | null = null;
    let headers: string[] = [];

    rows.forEach((row) => {
      const firstCell = Object.values(row)[0].toString().trim();

      // Determine section
      if (["Positions", "Orders", "Deals"].includes(firstCell)) {
        currentSection = firstCell as keyof TradeHistory;
        headers = [];
        return;
      }

      if (!currentSection) return; // skip rows outside sections

      // If headers not set yet, take the first row as headers
      if (!headers.length) {
        headers = Object.values(row).map((v) => v.toString().trim());
        return;
      }

      // Otherwise treat as data row
      const rowData: Record<string, string> = {};
      headers.forEach((h, i) => {
        const value = Object.values(row)[i]?.toString() ?? "";
        rowData[h] = value;
      });

      results[currentSection].push(rowData);
    });
  });

  return results;
}

function calculateStats(tradeData: TradeHistory) {
  const deals = tradeData.Deals || [];

  const totalTrades = deals.length;
  let wins = 0;
  let losses = 0;
  let totalProfit = 0;
  let maxProfit = -Infinity;
  let maxLoss = Infinity;
  const equityCurve: number[] = [];
  let runningProfit = 0;

  deals.forEach((deal) => {
    const profit = parseFloat(deal["Profit"] || "0");
    totalProfit += profit;
    runningProfit += profit;
    equityCurve.push(runningProfit);

    if (profit > 0) wins++;
    if (profit < 0) losses++;

    if (profit > maxProfit) maxProfit = profit;
    if (profit < maxLoss) maxLoss = profit;
  });

  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

  return {
    totalTrades,
    wins,
    losses,
    winRate: winRate.toFixed(2),
    totalProfit: totalProfit.toFixed(2),
    maxProfit,
    maxLoss,
    equityCurve,
  };
}

app.get("/trade-stats", (req, res) => {
  try {
    const tradeData = parseTradeHistory();
    const stats = calculateStats(tradeData);
    res.json({ stats, tradeData });
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
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { text-align: center; }
        table { border-collapse: collapse; margin-bottom: 30px; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: center; }
        th { background-color: #f4f4f4; }
        .section-title { margin-top: 50px; text-transform: uppercase; color: #333; }
      </style>
    </head>
    <body>
      <h1>Trade History</h1>
      <div id="app">Loading...</div>
      <script>
        fetch('/trade-stats')
          .then(res => res.json())
          .then(({ tradeData }) => {
            const container = document.getElementById('app');
            container.innerHTML = '';

            Object.entries(tradeData).forEach(([sectionName, rows]) => {
              if (!rows.length) return;

              const sectionHeader = document.createElement('h2');
              sectionHeader.className = 'section-title';
              sectionHeader.textContent = sectionName;
              container.appendChild(sectionHeader);

              const table = document.createElement('table');
              const thead = document.createElement('thead');
              const tbody = document.createElement('tbody');

              const headers = Object.keys(rows[0]);
              const headerRow = document.createElement('tr');
              headers.forEach(h => {
                const th = document.createElement('th');
                th.textContent = h;
                headerRow.appendChild(th);
              });
              thead.appendChild(headerRow);

              rows.forEach(row => {
                const tr = document.createElement('tr');
                headers.forEach(h => {
                  const td = document.createElement('td');
                  td.textContent = row[h] || '';
                  tr.appendChild(td);
                });
                tbody.appendChild(tr);
              });

              table.appendChild(thead);
              table.appendChild(tbody);
              container.appendChild(table);
            });
          })
          .catch(err => { document.getElementById('app').innerHTML = 'Error: ' + err; });
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
