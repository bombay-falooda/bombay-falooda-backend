const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function syncMenu() {
  console.log('--- STARTING BOMBAY FALOODA MENU SYNC ---');

  const menuData = JSON.parse(fs.readFileSync(path.join(__dirname, 'extracted_menu.json'), 'utf8'));
  console.log(`Loaded ${menuData.length} categories from extracted_menu.json`);

  // 1. Fetch Outlets
  const outlets = await prisma.outlet.findMany();
  console.log(`Found ${outlets.length} outlets in database:`, outlets.map(o => o.name));

  // 2. Safely clean old menu items and relations
  console.log('Clearing old OutletMenuItem records...');
  await prisma.outletMenuItem.deleteMany({});

  console.log('Clearing old MenuAddon & MenuAddonGroup records...');
  await prisma.menuAddon.deleteMany({});
  await prisma.menuAddonGroup.deleteMany({});

  console.log('Clearing old OrderItem and BillItem records from test orders...');
  await prisma.orderItem.deleteMany({});
  await prisma.billItem.deleteMany({});

  console.log('Clearing old MenuItem & MenuCategory records...');
  await prisma.menuItem.deleteMany({});
  await prisma.menuCategory.deleteMany({});

  console.log('Existing menu cleared cleanly.\n');

  let totalItemsCreated = 0;
  let totalAddonsCreated = 0;
  let totalOutletMappings = 0;

  // 3. Insert new Categories & Items
  for (const catData of menuData) {
    console.log(`Creating Category: "${catData.name}" (sortOrder: ${catData.sortOrder})`);
    const category = await prisma.menuCategory.create({
      data: {
        name: catData.name,
        sortOrder: catData.sortOrder,
        isActive: true,
      },
    });

    for (const itemData of catData.items) {
      const item = await prisma.menuItem.create({
        data: {
          categoryId: category.id,
          name: itemData.name,
          basePrice: itemData.basePrice,
          isActive: true,
        },
      });
      totalItemsCreated++;

      // Create Size Variant Addon Group if applicable
      if (itemData.sizes && itemData.sizes.length > 0) {
        const sizeGroup = await prisma.menuAddonGroup.create({
          data: {
            itemId: item.id,
            name: 'Size / Portion',
            minSelect: 1,
            maxSelect: 1,
            isRequired: true,
            sortOrder: 1,
            addons: {
              create: itemData.sizes.map((s, idx) => ({
                name: s.name,
                price: s.price,
                sortOrder: idx + 1,
                isActive: true,
              })),
            },
          },
        });
        totalAddonsCreated += itemData.sizes.length;
      }

      // Create Extra Addons Group if applicable
      if (itemData.addons && itemData.addons.length > 0) {
        const extraGroup = await prisma.menuAddonGroup.create({
          data: {
            itemId: item.id,
            name: 'Extra Add-ons',
            minSelect: 0,
            maxSelect: itemData.addons.length,
            isRequired: false,
            sortOrder: 2,
            addons: {
              create: itemData.addons.map((a, idx) => ({
                name: a.name,
                price: a.price,
                sortOrder: idx + 1,
                isActive: true,
              })),
            },
          },
        });
        totalAddonsCreated += itemData.addons.length;
      }

      // Map to ALL Outlets
      for (const outlet of outlets) {
        await prisma.outletMenuItem.create({
          data: {
            outletId: outlet.id,
            itemId: item.id,
            price: itemData.basePrice,
            isActive: true,
            dineIn: true,
            takeaway: true,
            delivery: true,
          },
        });
        totalOutletMappings++;
      }
    }
  }

  console.log('\n=== MENU SYNC COMPLETED SUCCESSFULLY ===');
  console.log(`✅ Categories Created: ${menuData.length}`);
  console.log(`✅ Menu Items Created: ${totalItemsCreated}`);
  console.log(`✅ Add-ons & Sizes Created: ${totalAddonsCreated}`);
  console.log(`✅ Outlet-Item Mappings Created: ${totalOutletMappings} (across ${outlets.length} outlets)`);

  await prisma.$disconnect();
}

syncMenu().catch(err => {
  console.error('Error during menu sync:', err);
  process.exit(1);
});
