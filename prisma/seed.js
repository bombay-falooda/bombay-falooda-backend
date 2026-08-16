const {
  MenuSetupStatus,
  OrderSource,
  OutletStatus,
  PosDeviceStatus,
  PosDeviceType,
  PrismaClient,
  UserRole,
  UserStatus,
} = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_SUPERADMIN_EMAIL || 'admin@bombayfalooda.com';
  const password = process.env.SEED_SUPERADMIN_PASSWORD || 'Admin@123';
  const name = process.env.SEED_SUPERADMIN_NAME || 'Super Admin';
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`Superadmin already exists: ${email}`);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: UserRole.SUPERADMIN,
        status: UserStatus.ACTIVE,
        twoFactorEnabled: false,
      },
    });

    console.log(`Created Superadmin: ${email}`);
    console.log('Default password:', password);
  }

  if (process.env.SEED_DEMO_FRANCHISE !== 'true') {
    return;
  }

  const ownerEmail = process.env.SEED_FRANCHISE_OWNER_EMAIL || 'owner@bombayfalooda.com';
  const ownerPassword = process.env.SEED_FRANCHISE_OWNER_PASSWORD || 'Owner@12345';

  const franchise = await prisma.franchise.upsert({
    where: { id: 'demo-franchise-bombay-falooda' },
    update: {},
    create: {
      id: 'demo-franchise-bombay-falooda',
      name: 'Bombay Falooda Demo Franchise',
      ownerName: 'Demo Owner',
      email: ownerEmail,
      phone: '9999999999',
      address: 'Kirtistambh Road',
      city: 'Palghar',
      state: 'Maharashtra',
      pincode: '401404',
    },
  });

  const outlet = await prisma.outlet.upsert({
    where: { code: 'BF-DEMO-001' },
    update: {},
    create: {
      franchiseId: franchise.id,
      name: 'Kirtistambh Main',
      code: 'BF-DEMO-001',
      address: 'Kirtistambh Road, Palghar',
      phone: '8888888888',
      email: 'kirtistambh@bombayfalooda.com',
      status: OutletStatus.ACTIVE,
      menuSetupStatus: MenuSetupStatus.PUBLISHED,
      openingTime: '10:00',
      closingTime: '23:00',
    },
  });

  await prisma.user.upsert({
    where: { email: ownerEmail },
    update: { franchiseId: franchise.id },
    create: {
      name: 'Demo Franchise Owner',
      email: ownerEmail,
      passwordHash: await bcrypt.hash(ownerPassword, 12),
      role: UserRole.FRANCHISE_OWNER,
      status: UserStatus.ACTIVE,
      franchiseId: franchise.id,
      twoFactorEnabled: false,
    },
  });

  const pos = await prisma.posDevice.upsert({
    where: { accessKey: 'POS-DEMO-001' },
    update: {},
    create: {
      outletId: outlet.id,
      name: 'Main Counter POS',
      type: PosDeviceType.PERMANENT,
      status: PosDeviceStatus.ACTIVE,
      accessKey: 'POS-DEMO-001',
      deviceCode: 'BF-POS-001',
    },
  });

  const category = await prisma.menuCategory.upsert({
    where: { id: 'demo-category-falooda' },
    update: {},
    create: {
      id: 'demo-category-falooda',
      name: 'Falooda',
      sortOrder: 1,
    },
  });

  const item = await prisma.menuItem.upsert({
    where: { id: 'demo-item-classic-falooda' },
    update: {},
    create: {
      id: 'demo-item-classic-falooda',
      categoryId: category.id,
      name: 'Classic Bombay Falooda',
      description: 'Rose, rabdi, basil seeds and kulfi.',
      basePrice: 159,
    },
  });

  await prisma.outletMenuItem.upsert({
    where: { outletId_itemId: { outletId: outlet.id, itemId: item.id } },
    update: {},
    create: {
      outletId: outlet.id,
      itemId: item.id,
      price: 159,
      isActive: true,
    },
  });

  await prisma.orderRoute.upsert({
    where: { outletId_source: { outletId: outlet.id, source: OrderSource.WEBSITE } },
    update: {},
    create: {
      outletId: outlet.id,
      source: OrderSource.WEBSITE,
      posDeviceId: pos.id,
      isActive: true,
    },
  });

  console.log(`Created/updated demo franchise owner: ${ownerEmail}`);
  console.log('Demo franchise owner password:', ownerPassword);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
