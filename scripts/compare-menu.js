const xlsx = require('xlsx');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function parseAndCompare() {
  const filePath = path.resolve('..', 'bombay falooda NEW UPDATE.xlsx');
  const wb = xlsx.readFile(filePath);
  const ws = wb.Sheets['Sheet1'];
  const rawData = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

  console.log(`=== RAW EXCEL ANALYSIS (${rawData.length} rows) ===\n`);

  // Let's inspect all rows of the sheet
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const nonEmp = row.filter(c => c !== '');
    if (nonEmp.length > 0) {
      console.log(`[Row ${String(i + 1).padStart(3, ' ')}]`, JSON.stringify(row));
    }
  }

  console.log('\n===============================\n');

  // Let's get current DB data
  const dbCategories = await prisma.menuCategory.findMany({
    include: {
      items: {
        include: {
          outletMenuItems: true,
          addonGroups: {
            include: {
              addons: true,
            },
          },
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  console.log(`=== CURRENT DATABASE MENU (${dbCategories.length} Categories) ===\n`);
  let totalDbItems = 0;
  for (const cat of dbCategories) {
    console.log(`📂 Category: "${cat.name}" (ID: ${cat.id}, Items: ${cat.items.length})`);
    for (const item of cat.items) {
      totalDbItems++;
      console.log(`   - "${item.name}" | Base Price: ₹${item.basePrice} | SubCategory: ${item.subCategory || 'N/A'}`);
    }
  }
  console.log(`\nTotal Current Items in DB: ${totalDbItems}`);

  const outlets = await prisma.outlet.findMany({ select: { id: true, name: true, code: true } });
  console.log(`\nActive Outlets (${outlets.length}):`, outlets.map(o => `${o.name} (${o.code})`));

  await prisma.$disconnect();
}

parseAndCompare().catch(e => {
  console.error(e);
  process.exit(1);
});
