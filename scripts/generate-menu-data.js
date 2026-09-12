const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.resolve('..', 'bombay falooda NEW UPDATE.xlsx');
const wb = xlsx.readFile(filePath);
const ws = wb.Sheets['Sheet1'];
const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

// Parse all sections into structured menu
const categories = [];

// 1. FALOODA
const faloodaItems = [];
for (let r = 1; r <= 9; r++) { // R2 to R10
  const name = String(rows[r][0] || '').trim();
  const p300 = Number(rows[r][1]) || 0;
  const p350 = Number(rows[r][2]) || 0;
  const p400 = Number(rows[r][3]) || 0;
  if (name && p300 > 0) {
    faloodaItems.push({
      name,
      basePrice: p300,
      sizes: [
        { name: 'Mawa Falooda (300 ML)', price: p300 },
        { name: 'Dry Fruits Mawa Falooda (350 ML)', price: p350 },
        { name: 'Special Dryfruit Mawa Falooda (400 ML)', price: p400 },
      ],
      addons: [
        { name: 'Extra Mawa', price: 20 },
        { name: 'Extra Dry Fruits', price: 20 },
      ]
    });
  }
}
categories.push({ name: 'Falooda', sortOrder: 1, items: faloodaItems });

// 2. KULFI FALOODA
const kulfiFaloodaItems = [];
for (let r = 1; r <= 9; r++) {
  const name = String(rows[r][5] || '').trim();
  const p300 = Number(rows[r][6]) || 0;
  const p400 = Number(rows[r][7]) || 0;
  if (name) {
    if (p400 > 0) {
      kulfiFaloodaItems.push({
        name,
        basePrice: p300,
        sizes: [
          { name: 'Mawa Falooda (300 ML)', price: p300 },
          { name: 'Special Dryfruit Mawa Falooda (400 ML)', price: p400 },
        ],
        addons: [
          { name: 'Extra Mawa', price: 20 },
          { name: 'Extra Dry Fruits', price: 20 },
        ]
      });
    } else if (p300 > 0) {
      kulfiFaloodaItems.push({
        name,
        basePrice: p300,
        sizes: [],
        addons: [
          { name: 'Extra Mawa', price: 20 },
          { name: 'Extra Dry Fruits', price: 20 },
        ]
      });
    }
  }
}
categories.push({ name: 'Kulfi Falooda', sortOrder: 2, items: kulfiFaloodaItems });

// 3. UPVAS (FAST) FALOODA
const upvasItems = [];
for (let r = 15; r <= 17; r++) { // R16 to R18
  const name = String(rows[r][0] || '').trim();
  const p300 = Number(rows[r][1]) || 0;
  const p350 = rows[r][2] === '-' ? 0 : Number(rows[r][2]) || 0;
  const p400 = Number(rows[r][3]) || 0;
  if (name) {
    const sizes = [];
    if (p300 > 0) sizes.push({ name: 'Mawa Falooda (300 ML)', price: p300 });
    if (p350 > 0) sizes.push({ name: 'Dry Fruits Mawa Falooda (350 ML)', price: p350 });
    if (p400 > 0) sizes.push({ name: 'Special Dryfruit Mawa Falooda (400 ML)', price: p400 });

    upvasItems.push({
      name,
      basePrice: p300,
      sizes,
      addons: [
        { name: 'Extra Mawa', price: 20 },
        { name: 'Extra Dry Fruits', price: 20 },
      ]
    });
  }
}
categories.push({ name: 'Upvas Falooda', sortOrder: 3, items: upvasItems });

// 4. RABDI FALOODA
const rabdiFaloodaItems = [];
for (let r = 15; r <= 17; r++) {
  const name = String(rows[r][5] || '').trim();
  const price = Number(rows[r][6]) || 0;
  if (name && price > 0) {
    rabdiFaloodaItems.push({
      name,
      basePrice: price,
      sizes: [],
      addons: [
        { name: 'Extra Mawa', price: 20 },
        { name: 'Extra Dry Fruits', price: 20 },
      ]
    });
  }
}
categories.push({ name: 'Rabdi Falooda', sortOrder: 4, items: rabdiFaloodaItems });

// 5. KULHAD RABDI
const kulhadItems = [];
for (let r = 21; r <= 26; r++) { // R22 to R27
  const name = String(rows[r][0] || '').trim();
  const half = Number(rows[r][1]) || 0;
  const full = Number(rows[r][2]) || 0;
  if (name && half > 0) {
    if (full > 0) {
      kulhadItems.push({
        name,
        basePrice: half,
        sizes: [
          { name: 'Half', price: half },
          { name: 'Full', price: full },
        ],
        addons: []
      });
    } else {
      kulhadItems.push({
        name,
        basePrice: half,
        sizes: [],
        addons: []
      });
    }
  }
}
categories.push({ name: 'Kulhad Rabdi', sortOrder: 5, items: kulhadItems });

// 6. BOWL DRY KULFI RABDI FALOODA
const bowlItems = [];
for (let r = 21; r <= 27; r++) {
  const name = String(rows[r][5] || '').trim();
  const price = Number(rows[r][6]) || 0;
  if (name && price > 0) {
    bowlItems.push({
      name,
      basePrice: price,
      sizes: [],
      addons: [
        { name: 'Extra Mawa', price: 20 },
        { name: 'Extra Dry Fruits', price: 20 },
      ]
    });
  }
}
categories.push({ name: 'Bowl Dry Kulfi Rabdi Falooda', sortOrder: 6, items: bowlItems });

// 7. COLD COCO
const cocoItems = [];
for (let r = 31; r <= 35; r++) { // R32 to R36
  const name = String(rows[r][0] || '').trim();
  const price = Number(rows[r][1]) || 0;
  if (name && price > 0) {
    cocoItems.push({
      name,
      basePrice: price,
      sizes: [],
      addons: []
    });
  }
}
categories.push({ name: 'Cold Coco', sortOrder: 7, items: cocoItems });

// 8. KULFI ROLL CUT TUKDA
const rollCutItems = [];
for (let r = 31; r <= 37; r++) {
  const name = String(rows[r][5] || '').trim();
  const half = Number(rows[r][6]) || 0;
  const full = Number(rows[r][7]) || 0;
  if (name && half > 0) {
    rollCutItems.push({
      name,
      basePrice: half,
      sizes: [
        { name: 'Half', price: half },
        { name: 'Full', price: full },
      ],
      addons: []
    });
  }
}
categories.push({ name: 'Kulfi Roll Cut Tukda', sortOrder: 8, items: rollCutItems });

// 9. BADAM SHAKE
const shakeItems = [];
for (let r = 41; r <= 45; r++) { // R42 to R46
  const name = String(rows[r][0] || '').trim();
  const price = Number(rows[r][1]) || 0;
  if (name && price > 0) {
    shakeItems.push({
      name,
      basePrice: price,
      sizes: [],
      addons: []
    });
  }
}
categories.push({ name: 'Badam Shake', sortOrder: 9, items: shakeItems });

// 10. KULFI STICK
const stickItems = [];
for (let r = 41; r <= 44; r++) {
  const name = String(rows[r][5] || '').trim();
  const price = Number(rows[r][6]) || 0;
  if (name && price > 0) {
    stickItems.push({
      name,
      basePrice: price,
      sizes: [],
      addons: []
    });
  }
}
categories.push({ name: 'Kulfi Stick', sortOrder: 10, items: stickItems });

// 11. REGULAR ICE CREAM
const regIceCream = [];
for (let r = 49; r <= 60; r++) { // R50 to R61
  const name = String(rows[r][0] || '').trim();
  const half = Number(rows[r][1]) || 0;
  const full = Number(rows[r][2]) || 0;
  const topping = Number(rows[r][3]) || 0;
  const p500 = Number(rows[r][4]) || 0;
  const p1000 = Number(rows[r][5]) || 0;
  if (name && half > 0) {
    regIceCream.push({
      name,
      basePrice: half,
      sizes: [
        { name: 'Half (1 Scoop)', price: half },
        { name: 'Full (2 Scoops)', price: full },
        { name: 'Special Topping', price: topping },
        { name: '500 ML Pack', price: p500 },
        { name: '1 LTR Pack', price: p1000 },
      ],
      addons: []
    });
  }
}
categories.push({ name: 'Regular Ice Cream', sortOrder: 11, items: regIceCream });

// 12. FRESH FRUITS ICE CREAM
const freshIceCream = [];
for (let r = 64; r <= 68; r++) { // R65 to R69
  const name = String(rows[r][0] || '').trim();
  const half = Number(rows[r][1]) || 0;
  const full = Number(rows[r][2]) || 0;
  const p500 = Number(rows[r][3]) || 0;
  const p1000 = Number(rows[r][4]) || 0;
  if (name && half > 0) {
    freshIceCream.push({
      name,
      basePrice: half,
      sizes: [
        { name: 'Half (1 Scoop)', price: half },
        { name: 'Full (2 Scoops)', price: full },
        { name: '500 ML Pack', price: p500 },
        { name: '1 LTR Pack', price: p1000 },
      ],
      addons: []
    });
  }
}
categories.push({ name: 'Fresh Fruits Ice Cream', sortOrder: 12, items: freshIceCream });

// 13. PREMIUM ICE CREAM
const premIceCream = [];
for (let r = 72; r <= 77; r++) { // R73 to R78
  const name = String(rows[r][0] || '').trim();
  const half = Number(rows[r][1]) || 0;
  const full = Number(rows[r][2]) || 0;
  const p500 = Number(rows[r][3]) || 0;
  const p1000 = Number(rows[r][4]) || 0;
  if (name && half > 0) {
    premIceCream.push({
      name,
      basePrice: half,
      sizes: [
        { name: 'Half (1 Scoop)', price: half },
        { name: 'Full (2 Scoops)', price: full },
        { name: '500 ML Pack', price: p500 },
        { name: '1 LTR Pack', price: p1000 },
      ],
      addons: []
    });
  }
}
categories.push({ name: 'Premium Ice Cream', sortOrder: 13, items: premIceCream });

console.log('Categories extracted:', categories.map(c => `${c.name} (${c.items.length} items)`));
const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);
console.log('Total items extracted:', totalItems);

fs.writeFileSync(path.resolve('extracted_menu.json'), JSON.stringify(categories, null, 2));
console.log('Saved extracted_menu.json');
