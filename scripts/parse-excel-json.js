const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

function parseExcel() {
  const filePath = path.resolve('..', 'bombay falooda NEW UPDATE.xlsx');
  const wb = xlsx.readFile(filePath);
  const ws = wb.Sheets['Sheet1'];
  const rawData = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

  console.log(`Total rows in Excel: ${rawData.length}`);

  const parsedCategories = [];
  let currentCategory = null;

  // Let's print out all rows to understand the layout
  const rows = [];
  rawData.forEach((r, idx) => {
    const hasData = r.some(c => c !== '');
    if (hasData) {
      rows.push({ rowIndex: idx + 1, data: r });
    }
  });

  fs.writeFileSync(path.resolve('excel_parsed_raw.json'), JSON.stringify(rows, null, 2));
  console.log(`Wrote ${rows.length} non-empty rows to excel_parsed_raw.json`);
}

parseExcel();
