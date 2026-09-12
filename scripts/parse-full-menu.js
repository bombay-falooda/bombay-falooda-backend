const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.resolve('..', 'bombay falooda NEW UPDATE.xlsx');
const wb = xlsx.readFile(filePath);
const ws = wb.Sheets['Sheet1'];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

console.log('=== STRUCTURED PARSING OF NEW MENU EXCEL ===\n');

// Let's print each section and extract
const parsedMenu = [];

// 1. Falooda (Rows 2 to 10, Cols 0-3)
// 2. Kulfi Falooda (Rows 2 to 10, Cols 5-7)
// 3. Upvas Falooda (Rows 16 to 18, Cols 0-3)
// 4. Rabdi Falooda (Rows 16 to 18, Cols 5-7)
// 5. Kulhad Rabdi (Rows 22 to 27, Cols 0-2)
// 6. Bowl Dry Kulfi Rabdi Falooda (Rows 22 to 28, Cols 5-7)
// 7. Cold Coco (Rows 32 to 36, Cols 0-2)
// 8. Kulfi Roll Cut Tukda (Rows 32 to 38, Cols 5-7)
// 9. Badam Shake (Rows 42 to 46, Cols 0-2)
// 10. Kulfi Stick (Rows 42 to 45, Cols 5-7)
// 11. Ice Cream Regular (Rows 50 to 61, Cols 0-5)
// 12. Fresh Fruits Ice Cream (Rows 65 to 69, Cols 0-4)
// 13. Premium Ice Cream (Rows 73 to 78, Cols 0-4)

for (let r = 0; r < rows.length; r++) {
  const row = rows[r];
  const str = row.map(c => (c !== '' ? String(c).trim() : '')).filter(Boolean);
  if (str.length > 0) {
    console.log(`[R${r + 1}]`, str);
  }
}
