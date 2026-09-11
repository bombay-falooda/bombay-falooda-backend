/**
 * Bombay Falooda - Complete Menu Seed Script
 * Run from: /var/www/bombay-falooda/apps/backend
 * Command: node prisma/seed-menu.js
 */

const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const FRANCHISE_OWNER_PHONE = '8905979712';
const POS_ACCESS_KEY = 'POS-7218AE7B7463';
const DEFAULT_OWNER_PASSWORD = 'Owner@bf.2026';

// ─── MENU DATA ────────────────────────────────────────────────────────────────

const FALOODA_ITEMS = [
  { name: 'Kesar Falooda',        basePrice: 60 },
  { name: 'Rajbhog Falooda',      basePrice: 60 },
  { name: 'Mango Falooda',        basePrice: 60 },
  { name: 'Rose Falooda',         basePrice: 60 },
  { name: 'Green Pista Falooda',  basePrice: 60 },
  { name: 'Kaju Cream Falooda',   basePrice: 60 },
  { name: 'Butterscotch Falooda', basePrice: 60 },
  { name: 'Pineapple Falooda',    basePrice: 60 },
  { name: 'Diabetes Falooda',     basePrice: 60 },
  { name: 'Chocolate Falooda',    basePrice: 70 },
];

// Addon group shared by all Falooda items
const FALOODA_SIZE_ADDONS = [
  { name: 'Mawa (300 ML)',                   price: 0,  sortOrder: 1 },
  { name: 'Dry Fruits Mawa (300 ML)',        price: 10, sortOrder: 2 },
  { name: 'Sp. Dryfruit Mawa (400 ML)',      price: 30, sortOrder: 3 },
];

const KULFI_FALOODA_ITEMS = [
  { name: 'Kesar Kulfi Falooda',       basePrice: 80 },
  { name: 'Green Pista Kulfi Falooda', basePrice: 80 },
  { name: 'Mango Kulfi Falooda',       basePrice: 80 },
  { name: 'Rose Kulfi Falooda',        basePrice: 80 },
  { name: 'Rajbhog Kulfi Falooda',     basePrice: 90 },
  { name: 'Chocolate Kulfi Falooda',   basePrice: 90 },
];

const KULFI_FALOODA_SIZE_ADDONS = [
  { name: 'Mawa (300 ML)',              price: 0,  sortOrder: 1 },
  { name: 'Sp. Dryfruit Mawa (400 ML)', price: 40, sortOrder: 2 },
];

const RABDI_FALOODA_ITEMS = [
  { name: 'Rabdi Mawa Falooda (300 ML)',                  basePrice: 80 },
  { name: 'Rabdi Dryfruit Mawa Falooda (350 ML)',         basePrice: 90 },
  { name: 'Rabdi Special Dryfruit Mawa Falooda (400 ML)', basePrice: 110 },
];

const BOWL_FALOODA_ITEMS = [
  { name: 'Mawa Malai Bowl Falooda',  basePrice: 120 },
  { name: 'Mango Bowl Falooda',       basePrice: 120 },
  { name: 'Rose Bowl Falooda',        basePrice: 120 },
  { name: 'Green Pista Bowl Falooda', basePrice: 120 },
  { name: 'Chocolate Bowl Falooda',   basePrice: 130 },
  { name: 'Rajbhog Bowl Falooda',     basePrice: 140 },
  { name: 'Mix Bowl Falooda',         basePrice: 150 },
];

const UPVAS_FALOODA_ITEMS = [
  { name: 'Upvas Falooda',       basePrice: 60, addons: [
    { name: 'Mawa (300 ML)',              price: 0,  sortOrder: 1 },
    { name: 'Dryfruit (300 ML)',          price: 10, sortOrder: 2 },
    { name: 'Sp. Dryfruit Mawa (400 ML)', price: 30, sortOrder: 3 },
  ]},
  { name: 'Rabdi Upvas Falooda', basePrice: 80, addons: [
    { name: 'Mawa (300 ML)',    price: 0,  sortOrder: 1 },
    { name: 'Dryfruit (300 ML)', price: 10, sortOrder: 2 },
  ]},
  { name: 'Kulfi Upvas Falooda', basePrice: 80, addons: [
    { name: 'Mawa (300 ML)',              price: 0,  sortOrder: 1 },
    { name: 'Sp. Dryfruit Mawa (400 ML)', price: 40, sortOrder: 2 },
  ]},
];

const BOMBAY_SPECIAL_ITEMS = [
  {
    name: 'Bombay Special Falooda (400 ML)',
    description: 'Rabdi, Falooda (Sev), Sabja (Seeds), Ice Cream, Kulfi, Dryfruit, Mawa & Topping',
    basePrice: 150,
  },
];

// Ice Cream - base price = Half, addons for other sizes
const ICE_CREAM_ITEMS = [
  { name: 'Venila Ice Cream',              basePrice: 20, addons: [
    { name: 'Half',          price: 0,   sortOrder: 1 },
    { name: 'Full',          price: 20,  sortOrder: 2 },
    { name: 'Special Topping', price: 40, sortOrder: 3 },
    { name: '500 ML',        price: 80,  sortOrder: 4 },
    { name: '1 LTR',         price: 160, sortOrder: 5 },
  ]},
  { name: 'Mawa Malai Ice Cream',          basePrice: 30, addons: [
    { name: 'Half',          price: 0,   sortOrder: 1 },
    { name: 'Full',          price: 30,  sortOrder: 2 },
    { name: 'Special Topping', price: 50, sortOrder: 3 },
    { name: '500 ML',        price: 120, sortOrder: 4 },
    { name: '1 LTR',         price: 250, sortOrder: 5 },
  ]},
  { name: 'Strawberry Ice Cream',          basePrice: 30, addons: [
    { name: 'Half', price: 0, sortOrder: 1 }, { name: 'Full', price: 30, sortOrder: 2 },
    { name: 'Special Topping', price: 50, sortOrder: 3 }, { name: '500 ML', price: 120, sortOrder: 4 }, { name: '1 LTR', price: 250, sortOrder: 5 },
  ]},
  { name: 'Butterscotch Ice Cream',        basePrice: 30, addons: [
    { name: 'Half', price: 0, sortOrder: 1 }, { name: 'Full', price: 30, sortOrder: 2 },
    { name: 'Special Topping', price: 50, sortOrder: 3 }, { name: '500 ML', price: 120, sortOrder: 4 }, { name: '1 LTR', price: 250, sortOrder: 5 },
  ]},
  { name: 'American Dryfruit Ice Cream',   basePrice: 30, addons: [
    { name: 'Half', price: 0, sortOrder: 1 }, { name: 'Full', price: 30, sortOrder: 2 },
    { name: 'Special Topping', price: 50, sortOrder: 3 }, { name: '500 ML', price: 120, sortOrder: 4 }, { name: '1 LTR', price: 250, sortOrder: 5 },
  ]},
  { name: 'Rajbhog Ice Cream',             basePrice: 30, addons: [
    { name: 'Half', price: 0, sortOrder: 1 }, { name: 'Full', price: 30, sortOrder: 2 },
    { name: 'Special Topping', price: 50, sortOrder: 3 }, { name: '500 ML', price: 120, sortOrder: 4 }, { name: '1 LTR', price: 250, sortOrder: 5 },
  ]},
  { name: 'Chocolate Chips Ice Cream',     basePrice: 30, addons: [
    { name: 'Half', price: 0, sortOrder: 1 }, { name: 'Full', price: 30, sortOrder: 2 },
    { name: 'Special Topping', price: 50, sortOrder: 3 }, { name: '500 ML', price: 120, sortOrder: 4 }, { name: '1 LTR', price: 250, sortOrder: 5 },
  ]},
  { name: 'Cookies Cream Ice Cream',       basePrice: 30, addons: [
    { name: 'Half', price: 0, sortOrder: 1 }, { name: 'Full', price: 30, sortOrder: 2 },
    { name: 'Special Topping', price: 50, sortOrder: 3 }, { name: '500 ML', price: 120, sortOrder: 4 }, { name: '1 LTR', price: 250, sortOrder: 5 },
  ]},
  { name: 'Kaju Gulkand Ice Cream',        basePrice: 30, addons: [
    { name: 'Half', price: 0, sortOrder: 1 }, { name: 'Full', price: 30, sortOrder: 2 },
    { name: 'Special Topping', price: 50, sortOrder: 3 }, { name: '500 ML', price: 120, sortOrder: 4 }, { name: '1 LTR', price: 250, sortOrder: 5 },
  ]},
  { name: 'Pan Masala Ice Cream',          basePrice: 30, addons: [
    { name: 'Half', price: 0, sortOrder: 1 }, { name: 'Full', price: 30, sortOrder: 2 },
    { name: '500 ML', price: 120, sortOrder: 3 }, { name: '1 LTR', price: 250, sortOrder: 4 },
  ]},
  { name: 'Mango Plain Ice Cream',         basePrice: 30, addons: [
    { name: 'Half', price: 0, sortOrder: 1 }, { name: 'Full', price: 30, sortOrder: 2 },
    { name: 'Special Topping', price: 50, sortOrder: 3 }, { name: '500 ML', price: 120, sortOrder: 4 }, { name: '1 LTR', price: 250, sortOrder: 5 },
  ]},
  { name: 'Sugar Free Ice Cream',          basePrice: 30, addons: [
    { name: 'Half', price: 0, sortOrder: 1 }, { name: 'Full', price: 30, sortOrder: 2 },
    { name: 'Special Topping', price: 50, sortOrder: 3 }, { name: '500 ML', price: 120, sortOrder: 4 }, { name: '1 LTR', price: 250, sortOrder: 5 },
  ]},
];

const FRESH_ICE_CREAM_ADDONS = [
  { name: 'Half',   price: 0,   sortOrder: 1 },
  { name: 'Full',   price: 30,  sortOrder: 2 },
  { name: '500 ML', price: 140, sortOrder: 3 },
  { name: '1 LTR',  price: 300, sortOrder: 4 },
];

const FRESH_ICE_CREAM_ITEMS = [
  { name: 'Guava (Jamfal) Fresh Ice Cream',  basePrice: 40 },
  { name: 'Sitaphal Fresh Ice Cream',        basePrice: 40 },
  { name: 'Jambun Fresh Ice Cream',          basePrice: 40 },
  { name: 'Blue Berry Fresh Ice Cream',      basePrice: 40 },
  { name: 'Coconut Malai Fresh Ice Cream',   basePrice: 40 },
];

const PREMIUM_ICE_CREAM_ITEMS = [
  { name: 'Anjeer Mawa Ice Cream',         basePrice: 40, addons: [
    { name: 'Half', price: 0, sortOrder: 1 }, { name: 'Full', price: 30, sortOrder: 2 },
    { name: '500 ML', price: 140, sortOrder: 3 }, { name: '1 LTR', price: 300, sortOrder: 4 },
  ]},
  { name: 'Goldan Parl Ice Cream',         basePrice: 40, addons: [
    { name: 'Half', price: 0, sortOrder: 1 }, { name: 'Full', price: 30, sortOrder: 2 },
    { name: '500 ML', price: 140, sortOrder: 3 }, { name: '1 LTR', price: 300, sortOrder: 4 },
  ]},
  { name: 'Chocolate Brownie Ice Cream',   basePrice: 40, addons: [
    { name: 'Half', price: 0, sortOrder: 1 }, { name: 'Full', price: 30, sortOrder: 2 },
    { name: '500 ML', price: 140, sortOrder: 3 }, { name: '1 LTR', price: 300, sortOrder: 4 },
  ]},
  { name: 'Mawa Magic Ice Cream',          basePrice: 45, addons: [
    { name: 'Half', price: 0, sortOrder: 1 }, { name: 'Full', price: 35, sortOrder: 2 },
    { name: '500 ML', price: 155, sortOrder: 3 }, { name: '1 LTR', price: 335, sortOrder: 4 },
  ]},
  { name: 'Dark Chocolate Mawa Ice Cream', basePrice: 45, addons: [
    { name: 'Half', price: 0, sortOrder: 1 }, { name: 'Full', price: 35, sortOrder: 2 },
    { name: '500 ML', price: 155, sortOrder: 3 }, { name: '1 LTR', price: 335, sortOrder: 4 },
  ]},
  { name: 'Almond Carnival Ice Cream',     basePrice: 45, addons: [
    { name: 'Half', price: 0, sortOrder: 1 }, { name: 'Full', price: 35, sortOrder: 2 },
    { name: '500 ML', price: 155, sortOrder: 3 }, { name: '1 LTR', price: 335, sortOrder: 4 },
  ]},
  { name: 'Kaju Katli Ice Cream',          basePrice: 45, addons: [
    { name: 'Half', price: 0, sortOrder: 1 }, { name: 'Full', price: 35, sortOrder: 2 },
    { name: '500 ML', price: 155, sortOrder: 3 }, { name: '1 LTR', price: 335, sortOrder: 4 },
  ]},
];

const COLD_COCO_ITEMS = [
  { name: 'Cold Coco (300 ML)',                         basePrice: 50 },
  { name: 'Cold Coco With Icecream (300 ML)',            basePrice: 60 },
  { name: 'Cold Coco With Dryfruit (300 ML)',            basePrice: 60 },
  { name: 'Cold Coco Icecream With Dryfruit (300 ML)',   basePrice: 70 },
  { name: 'Special Cold Coco (350 ML)',                  basePrice: 80 },
];

const BADAM_SHAKE_ITEMS = [
  { name: 'Badam Shake (300 ML)',                  basePrice: 60 },
  { name: 'Badam Shake With Icecream (300 ML)',    basePrice: 70 },
  { name: 'Badam Shake With Mawa (300 ML)',         basePrice: 70 },
  { name: 'Badam Shake Icecream With Mawa (300 ML)', basePrice: 80 },
  { name: 'Special Badam Shake (350 ML)',           basePrice: 90 },
];

const KULHAD_RABDI_ITEMS = [
  { name: 'Kulhad Rabdi',              basePrice: 50, addons: [
    { name: '100 ML', price: 0,  sortOrder: 1 },
    { name: '200 ML', price: 40, sortOrder: 2 },
  ]},
  { name: 'Kulhad Mawa Rabdi',         basePrice: 60, addons: [
    { name: '100 ML', price: 0,  sortOrder: 1 },
    { name: '200 ML', price: 40, sortOrder: 2 },
  ]},
  { name: 'Kulhad Dryfruit Rabdi',     basePrice: 60, addons: [
    { name: '100 ML', price: 0,  sortOrder: 1 },
    { name: '200 ML', price: 40, sortOrder: 2 },
  ]},
  { name: 'Kulhad Dryfruit Mawa Rabdi', basePrice: 70, addons: [
    { name: '100 ML', price: 0,  sortOrder: 1 },
    { name: '200 ML', price: 50, sortOrder: 2 },
  ]},
];

const KULFI_STICK_ITEMS = [
  { name: 'Mawa Malai Kulfi',       basePrice: 20 },
  { name: 'Green Pista Kulfi',      basePrice: 20 },
  { name: 'Mango Kulfi',            basePrice: 20 },
  { name: 'Chocolate Kulfi',        basePrice: 20 },
  { name: 'Rajbhog Kulfi',          basePrice: 25 },
  { name: 'Rajwadi Kulfi',          basePrice: 30 },
  { name: 'Guava (Jamfal) Kulfi',   basePrice: 30 },
];

const KULFI_TUKDA_ITEMS = [
  { name: 'Mawa Malai Kulfi Tukda',  basePrice: 50, addons: [
    { name: 'Half', price: 0,  sortOrder: 1 },
    { name: 'Full', price: 40, sortOrder: 2 },
  ]},
  { name: 'Mango Kulfi Tukda',       basePrice: 50, addons: [
    { name: 'Half', price: 0,  sortOrder: 1 },
    { name: 'Full', price: 40, sortOrder: 2 },
  ]},
  { name: 'Rose Kulfi Tukda',        basePrice: 50, addons: [
    { name: 'Half', price: 0,  sortOrder: 1 },
    { name: 'Full', price: 40, sortOrder: 2 },
  ]},
  { name: 'Green Pista Kulfi Tukda', basePrice: 50, addons: [
    { name: 'Half', price: 0,  sortOrder: 1 },
    { name: 'Full', price: 40, sortOrder: 2 },
  ]},
  { name: 'Chocolate Kulfi Tukda',   basePrice: 50, addons: [
    { name: 'Half', price: 0,  sortOrder: 1 },
    { name: 'Full', price: 40, sortOrder: 2 },
  ]},
  { name: 'Rajbhog Kulfi Tukda',     basePrice: 60, addons: [
    { name: 'Half', price: 0,  sortOrder: 1 },
    { name: 'Full', price: 50, sortOrder: 2 },
  ]},
  { name: 'Mix Kulfi Tukda',         basePrice: 60, addons: [
    { name: 'Half', price: 0,  sortOrder: 1 },
    { name: 'Full', price: 50, sortOrder: 2 },
  ]},
];

// Global extras addon (applied to Falooda items)
const EXTRAS_ADDONS = [
  { name: 'Extra Mawa (Small)',     price: 10, sortOrder: 1 },
  { name: 'Extra Mawa (Large)',     price: 20, sortOrder: 2 },
  { name: 'Extra Dryfruit (Small)', price: 10, sortOrder: 3 },
  { name: 'Extra Dryfruit (Large)', price: 20, sortOrder: 4 },
];

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

async function getOrCreateCategory(name, sortOrder) {
  const existing = await prisma.menuCategory.findFirst({ where: { name } });
  if (existing) return existing;
  return prisma.menuCategory.create({ data: { name, sortOrder, isActive: true } });
}

async function createMenuItem(categoryId, itemData, outletId) {
  const existing = await prisma.menuItem.findFirst({
    where: { name: itemData.name, categoryId },
  });

  let item;
  if (existing) {
    item = await prisma.menuItem.update({
      where: { id: existing.id },
      data: { basePrice: itemData.basePrice, isActive: true, description: itemData.description || null },
    });
    console.log(`  ↻ Updated: ${item.name}`);
  } else {
    item = await prisma.menuItem.create({
      data: {
        categoryId,
        name: itemData.name,
        description: itemData.description || null,
        basePrice: itemData.basePrice,
        isActive: true,
      },
    });
    console.log(`  + Created: ${item.name}`);
  }

  // Create addon groups if specified
  if (itemData.addons && itemData.addons.length > 0) {
    const existingGroup = await prisma.menuAddonGroup.findFirst({
      where: { itemId: item.id, name: 'Size' },
    });

    if (!existingGroup) {
      await prisma.menuAddonGroup.create({
        data: {
          itemId: item.id,
          name: 'Size',
          minSelect: 1,
          maxSelect: 1,
          isRequired: true,
          isActive: true,
          sortOrder: 1,
          addons: {
            create: itemData.addons.map(a => ({
              name: a.name,
              price: a.price,
              isActive: true,
              sortOrder: a.sortOrder,
            })),
          },
        },
      });
    }
  }

  // Link to outlet
  const existingOutletItem = await prisma.outletMenuItem.findFirst({
    where: { outletId, itemId: item.id },
  });

  if (!existingOutletItem) {
    await prisma.outletMenuItem.create({
      data: {
        outletId,
        itemId: item.id,
        price: itemData.basePrice,
        isActive: true,
        dineIn: true,
        takeaway: true,
        delivery: true,
      },
    });
  }

  return item;
}

async function createItemsWithSharedAddons(categoryId, items, sharedAddons, outletId, extraAddons = null) {
  for (const itemData of items) {
    const addonsToUse = itemData.addons || sharedAddons;
    await createMenuItem(categoryId, { ...itemData, addons: addonsToUse }, outletId);

    // Add extras addon group for Falooda items
    if (extraAddons) {
      const item = await prisma.menuItem.findFirst({
        where: { name: itemData.name, categoryId },
      });
      if (item) {
        const existingExtras = await prisma.menuAddonGroup.findFirst({
          where: { itemId: item.id, name: 'Extras' },
        });
        if (!existingExtras) {
          await prisma.menuAddonGroup.create({
            data: {
              itemId: item.id,
              name: 'Extras',
              minSelect: 0,
              maxSelect: 4,
              isRequired: false,
              isActive: true,
              sortOrder: 2,
              addons: {
                create: extraAddons.map(a => ({
                  name: a.name,
                  price: a.price,
                  isActive: true,
                  sortOrder: a.sortOrder,
                })),
              },
            },
          });
        }
      }
    }
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 Bombay Falooda — Complete Menu Setup\n');

  // ── 1. Franchise ──────────────────────────────────────────────────────────
  console.log('📋 Setting up Franchise...');
  let franchise = await prisma.franchise.findFirst({
    where: { phone: FRANCHISE_OWNER_PHONE },
  });
  if (!franchise) {
    franchise = await prisma.franchise.create({
      data: {
        name: 'Bombay Falooda - Tandalja',
        ownerName: 'Franchise Owner',
        phone: FRANCHISE_OWNER_PHONE,
        canManageMenu: true,
        canManageOutletStaff: true,
        canViewReports: true,
        canRouteOrders: true,
        canRequestExtraPos: true,
        isActive: true,
      },
    });
    console.log('  ✅ Franchise created:', franchise.id);
  } else {
    franchise = await prisma.franchise.update({
      where: { id: franchise.id },
      data: { name: 'Bombay Falooda - Tandalja' },
    });
    console.log('  ↻ Franchise updated:', franchise.id);
  }

  // ── 2. Franchise Owner User ───────────────────────────────────────────────
  console.log('👤 Setting up Franchise Owner...');
  const ownerHash = await bcrypt.hash(DEFAULT_OWNER_PASSWORD, 12);
  const franchiseOwner = await prisma.user.upsert({
    where: { phone: FRANCHISE_OWNER_PHONE },
    update: { franchiseId: franchise.id, role: 'FRANCHISE_OWNER', status: 'ACTIVE' },
    create: {
      name: 'Franchise Owner',
      phone: FRANCHISE_OWNER_PHONE,
      countryCode: '+91',
      passwordHash: ownerHash,
      role: 'FRANCHISE_OWNER',
      status: 'ACTIVE',
      franchiseId: franchise.id,
    },
  });
  console.log('  ✅ Owner:', franchiseOwner.phone, '| Password:', DEFAULT_OWNER_PASSWORD);

  // ── 3. Outlet ─────────────────────────────────────────────────────────────
  console.log('🏪 Setting up Outlet...');
  let outlet = await prisma.outlet.findFirst({ where: { franchiseId: franchise.id } });
  if (!outlet) {
    outlet = await prisma.outlet.create({
      data: {
        franchiseId: franchise.id,
        name: 'Bombay Falooda - Tandalja',
        code: 'BF-TANDALJA',
        address: 'Tandalja',
        city: 'Vadodara',
        state: 'Gujarat',
        status: 'ACTIVE',
        dineIn: true,
        takeaway: true,
        delivery: false,
        onlineOrderingEnabled: true,
        menuSetupStatus: 'DRAFT',
      },
    });
    console.log('  ✅ Outlet created:', outlet.id, '| Code:', outlet.code);
  } else {
    outlet = await prisma.outlet.update({
      where: { id: outlet.id },
      data: {
        name: 'Bombay Falooda - Tandalja',
        code: 'BF-TANDALJA',
        address: 'Tandalja',
        city: 'Vadodara',
        state: 'Gujarat',
      },
    });
    console.log('  ↻ Outlet updated:', outlet.id, '| Code:', outlet.code);
  }

  // ── 4. POS Device ─────────────────────────────────────────────────────────
  console.log('💻 Setting up POS Device...');
  const posDevice = await prisma.posDevice.upsert({
    where: { accessKey: POS_ACCESS_KEY },
    update: { outletId: outlet.id, status: 'ACTIVE' },
    create: {
      outletId: outlet.id,
      name: 'Main POS Terminal',
      type: 'PERMANENT',
      status: 'ACTIVE',
      accessKey: POS_ACCESS_KEY,
    },
  });
  console.log('  ✅ POS Device:', posDevice.accessKey);

  // ── 5. Menu Categories ────────────────────────────────────────────────────
  console.log('\n📂 Creating Menu Categories...');
  const cats = {};
  const categoryList = [
    { key: 'falooda',       name: 'Falooda',                       sortOrder: 1 },
    { key: 'kulfi_falooda', name: 'Kulfi Falooda',                  sortOrder: 2 },
    { key: 'rabdi_falooda', name: 'Rabdi Falooda',                  sortOrder: 3 },
    { key: 'bowl_falooda',  name: 'Bowl Dry Kulfi Rabdi Falooda',   sortOrder: 4 },
    { key: 'upvas_falooda', name: 'Upvas (Fast) Falooda',           sortOrder: 5 },
    { key: 'bombay_special',name: 'Bombay Special Falooda',         sortOrder: 6 },
    { key: 'ice_cream',     name: 'Ice Cream',                      sortOrder: 7 },
    { key: 'fresh_ic',      name: 'Fresh Fruits Ice Cream',         sortOrder: 8 },
    { key: 'premium_ic',    name: 'Premium Ice Cream',              sortOrder: 9 },
    { key: 'cold_coco',     name: 'Cold Coco',                      sortOrder: 10 },
    { key: 'badam_shake',   name: 'Badam Shake',                    sortOrder: 11 },
    { key: 'kulhad_rabdi',  name: 'Kulhad Rabdi',                   sortOrder: 12 },
    { key: 'kulfi_stick',   name: 'Kulfi Stick',                    sortOrder: 13 },
    { key: 'kulfi_tukda',   name: 'Kulfi Roll Cut Tukda',           sortOrder: 14 },
  ];

  for (const c of categoryList) {
    cats[c.key] = await getOrCreateCategory(c.name, c.sortOrder);
    console.log(`  ✅ ${c.name}`);
  }

  // ── 6. Menu Items ─────────────────────────────────────────────────────────
  console.log('\n🍨 Creating Menu Items...\n');

  console.log('--- Falooda ---');
  await createItemsWithSharedAddons(cats.falooda.id, FALOODA_ITEMS, FALOODA_SIZE_ADDONS, outlet.id, EXTRAS_ADDONS);

  console.log('\n--- Kulfi Falooda ---');
  await createItemsWithSharedAddons(cats.kulfi_falooda.id, KULFI_FALOODA_ITEMS, KULFI_FALOODA_SIZE_ADDONS, outlet.id, EXTRAS_ADDONS);

  console.log('\n--- Rabdi Falooda ---');
  for (const item of RABDI_FALOODA_ITEMS) {
    await createMenuItem(cats.rabdi_falooda.id, item, outlet.id);
  }

  console.log('\n--- Bowl Dry Kulfi Rabdi Falooda ---');
  for (const item of BOWL_FALOODA_ITEMS) {
    await createMenuItem(cats.bowl_falooda.id, item, outlet.id);
  }

  console.log('\n--- Upvas (Fast) Falooda ---');
  await createItemsWithSharedAddons(cats.upvas_falooda.id, UPVAS_FALOODA_ITEMS, null, outlet.id);

  console.log('\n--- Bombay Special Falooda ---');
  for (const item of BOMBAY_SPECIAL_ITEMS) {
    await createMenuItem(cats.bombay_special.id, item, outlet.id);
  }

  console.log('\n--- Ice Cream ---');
  for (const item of ICE_CREAM_ITEMS) {
    await createMenuItem(cats.ice_cream.id, item, outlet.id);
  }

  console.log('\n--- Fresh Fruits Ice Cream ---');
  await createItemsWithSharedAddons(cats.fresh_ic.id, FRESH_ICE_CREAM_ITEMS, FRESH_ICE_CREAM_ADDONS, outlet.id);

  console.log('\n--- Premium Ice Cream ---');
  for (const item of PREMIUM_ICE_CREAM_ITEMS) {
    await createMenuItem(cats.premium_ic.id, item, outlet.id);
  }

  console.log('\n--- Cold Coco ---');
  for (const item of COLD_COCO_ITEMS) {
    await createMenuItem(cats.cold_coco.id, item, outlet.id);
  }

  console.log('\n--- Badam Shake ---');
  for (const item of BADAM_SHAKE_ITEMS) {
    await createMenuItem(cats.badam_shake.id, item, outlet.id);
  }

  console.log('\n--- Kulhad Rabdi ---');
  for (const item of KULHAD_RABDI_ITEMS) {
    await createMenuItem(cats.kulhad_rabdi.id, item, outlet.id);
  }

  console.log('\n--- Kulfi Stick ---');
  for (const item of KULFI_STICK_ITEMS) {
    await createMenuItem(cats.kulfi_stick.id, item, outlet.id);
  }

  console.log('\n--- Kulfi Roll Cut Tukda ---');
  for (const item of KULFI_TUKDA_ITEMS) {
    await createMenuItem(cats.kulfi_tukda.id, item, outlet.id);
  }

  // ── 7. Update outlet menu status ──────────────────────────────────────────
  await prisma.outlet.update({
    where: { id: outlet.id },
    data: { menuSetupStatus: 'PUBLISHED' },
  });

  const totalItems = await prisma.menuItem.count();
  const totalOutletItems = await prisma.outletMenuItem.count({ where: { outletId: outlet.id } });

  console.log('\n═══════════════════════════════════════════════');
  console.log('🎉 MENU SETUP COMPLETE!');
  console.log('═══════════════════════════════════════════════');
  console.log(`📦 Total Menu Items    : ${totalItems}`);
  console.log(`🏪 Outlet Menu Items   : ${totalOutletItems}`);
  console.log(`📂 Categories          : ${categoryList.length}`);
  console.log(`🏪 Outlet Code         : ${outlet.code}`);
  console.log(`💻 POS Access Key      : ${POS_ACCESS_KEY}`);
  console.log(`👤 Franchise Owner     : ${FRANCHISE_OWNER_PHONE}`);
  console.log(`🔑 Owner Password      : ${DEFAULT_OWNER_PASSWORD}`);
  console.log('═══════════════════════════════════════════════\n');

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('❌ Error:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
