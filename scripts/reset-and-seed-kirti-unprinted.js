const { PrismaClient, BillStatus, OrderSource, PaymentMethod, BusinessDayStatus, OutletStatus, PosDeviceType, PosDeviceStatus, MenuSetupStatus } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function resetAndSeedKirtiUnprinted() {
  console.log('========================================================================');
  console.log('🍨 BOMBAY FALOODA — RESET & SEED UNPRINTED SHIFT (FOR SPLITTING TEST)');
  console.log('========================================================================\n');

  try {
    // 1. Locate Kirti Outlet
    let outlet = await prisma.outlet.findFirst({
      where: {
        OR: [
          { code: { contains: 'KIRTI', mode: 'insensitive' } },
          { name: { contains: 'Kirti', mode: 'insensitive' } },
          { code: 'BF-DEMO-001' },
        ],
      },
    });

    if (!outlet) {
      console.error('❌ Kirti outlet not found.');
      return;
    }

    console.log(`📍 Found Outlet: ${outlet.name} (ID: ${outlet.id})`);

    // 2. Clear previous test data for Kirti Outlet (Cascading Clean)
    console.log('🧹 Cleaning previous test orders and shift data for Kirti Outlet...');

    const oldBills = await prisma.bill.findMany({
      where: { outletId: outlet.id },
      select: { id: true },
    });
    const oldBillIds = oldBills.map((b) => b.id);

    if (oldBillIds.length > 0) {
      await prisma.$transaction([
        prisma.payment.deleteMany({ where: { billId: { in: oldBillIds } } }),
        prisma.billItem.deleteMany({ where: { billId: { in: oldBillIds } } }),
        prisma.kotTicket.deleteMany({ where: { billId: { in: oldBillIds } } }),
        prisma.bill.deleteMany({ where: { id: { in: oldBillIds } } }),
      ]);
      console.log(`   ✅ Removed ${oldBillIds.length} previous test bills.`);
    }

    // Close or remove old shifts for this outlet
    await prisma.outletBusinessDay.deleteMany({
      where: { outletId: outlet.id },
    });
    console.log('   ✅ Removed old shift records.');

    // 3. Setup POS Device
    const pinHash = await bcrypt.hash('0502', 12);
    let posDevice = await prisma.posDevice.findFirst({
      where: {
        OR: [
          { accessKey: 'POS-A92733A9ADCD' },
          { deviceCode: 'KIRTI-OLT-POS-01' },
        ],
      },
    });

    if (!posDevice) {
      posDevice = await prisma.posDevice.create({
        data: {
          outletId: outlet.id,
          name: 'Kirti Main Counter POS',
          deviceCode: 'KIRTI-OLT-POS-01',
          accessKey: 'POS-A92733A9ADCD',
          pinHash,
          type: PosDeviceType.PERMANENT,
          status: PosDeviceStatus.ACTIVE,
        },
      });
    } else {
      await prisma.posDevice.update({
        where: { id: posDevice.id },
        data: {
          accessKey: 'POS-A92733A9ADCD',
          deviceCode: 'KIRTI-OLT-POS-01',
          pinHash,
          status: PosDeviceStatus.ACTIVE,
        },
      });
    }

    console.log(`🖥️ POS Device: ${posDevice.name} (Code: ${posDevice.deviceCode}, PIN: 0502)`);

    // 4. Fetch menu items
    const menuItems = await prisma.outletMenuItem.findMany({
      where: { outletId: outlet.id, isActive: true },
      include: { item: true },
    });

    if (!menuItems.length) {
      console.error('❌ No active menu items found for outlet.');
      return;
    }

    // 5. Open Fresh Shift
    const activeDay = await prisma.outletBusinessDay.create({
      data: {
        outletId: outlet.id,
        posDeviceId: posDevice.id,
        status: BusinessDayStatus.OPEN,
        startedAt: new Date(Date.now() - 10 * 3600 * 1000), // Shift started 10h ago
      },
    });
    console.log(`\n🌅 Fresh Shift Opened (ID: ${activeDay.id.slice(0, 8)}...)`);

    // 6. Generate 24 Realistic Orders with an intentional ~35% Billed Ratio (Leaving Deficit to test splitting!)
    console.log('\n📦 Seeding 24 Orders across 4 Time Slots (Morning, Afternoon, Evening, Night):');

    const ordersToSeed = [
      // --- Morning Slot (10:00 AM - 01:00 PM) ---
      { name: 'Walk-in Cash #1', type: 'CASH', isPrinted: false, hoursAgo: 9.5, items: [{ item: menuItems[0], qty: 2 }] }, // ₹240 (Unprinted)
      { name: 'Zomato Rider #10', type: 'ONLINE', isPrinted: true, hoursAgo: 9.0, items: [{ item: menuItems[1], qty: 2 }] }, // ₹300 (Billed)
      { name: 'Walk-in Cash #2', type: 'CASH', isPrinted: false, hoursAgo: 8.5, items: [{ item: menuItems[2] || menuItems[0], qty: 1 }] }, // ₹180 (Unprinted)
      { name: 'Walk-in Cash #3', type: 'CASH', isPrinted: false, hoursAgo: 8.0, items: [{ item: menuItems[0], qty: 2 }] }, // ₹240 (Unprinted)
      { name: 'Counter UPI (GPay)', type: 'UPI', isPrinted: true, hoursAgo: 7.5, items: [{ item: menuItems[1], qty: 2 }] }, // ₹300 (Billed)
      { name: 'Walk-in Cash #4', type: 'CASH', isPrinted: false, hoursAgo: 7.0, items: [{ item: menuItems[2] || menuItems[0], qty: 2 }] }, // ₹360 (Unprinted)

      // --- Afternoon Slot (01:00 PM - 05:00 PM) ---
      { name: 'Walk-in Cash #5', type: 'CASH', isPrinted: false, hoursAgo: 6.0, items: [{ item: menuItems[0], qty: 1 }] }, // ₹120 (Unprinted)
      { name: 'Swiggy Rider #22', type: 'ONLINE', isPrinted: true, hoursAgo: 5.5, items: [{ item: menuItems[1], qty: 2 }] }, // ₹300 (Billed)
      { name: 'Walk-in Cash #6', type: 'CASH', isPrinted: false, hoursAgo: 5.0, items: [{ item: menuItems[0], qty: 2 }] }, // ₹240 (Unprinted)
      { name: 'Walk-in Cash #7', type: 'CASH', isPrinted: false, hoursAgo: 4.5, items: [{ item: menuItems[2] || menuItems[0], qty: 2 }] }, // ₹360 (Unprinted)
      { name: 'Counter UPI (PhonePe)', type: 'UPI', isPrinted: true, hoursAgo: 4.0, items: [{ item: menuItems[0], qty: 2 }] }, // ₹240 (Billed)
      { name: 'Walk-in Cash #8', type: 'CASH', isPrinted: false, hoursAgo: 3.5, items: [{ item: menuItems[1], qty: 2 }] }, // ₹300 (Unprinted)

      // --- Evening Rush Slot (05:00 PM - 09:00 PM) ---
      { name: 'Walk-in Cash #9', type: 'CASH', isPrinted: false, hoursAgo: 3.0, items: [{ item: menuItems[0], qty: 2 }] }, // ₹240 (Unprinted)
      { name: 'Zomato Rider #55', type: 'ONLINE', isPrinted: true, hoursAgo: 2.5, items: [{ item: menuItems[1], qty: 3 }] }, // ₹450 (Billed)
      { name: 'Walk-in Cash #10', type: 'CASH', isPrinted: false, hoursAgo: 2.0, items: [{ item: menuItems[2] || menuItems[0], qty: 2 }] }, // ₹360 (Unprinted)
      { name: 'Counter UPI (Paytm)', type: 'UPI', isPrinted: true, hoursAgo: 1.8, items: [{ item: menuItems[0], qty: 2 }] }, // ₹240 (Billed)
      { name: 'Walk-in Cash #11', type: 'CASH', isPrinted: false, hoursAgo: 1.5, items: [{ item: menuItems[1], qty: 2 }] }, // ₹300 (Unprinted)
      { name: 'Walk-in Cash #12', type: 'CASH', isPrinted: false, hoursAgo: 1.2, items: [{ item: menuItems[0], qty: 3 }] }, // ₹360 (Unprinted)

      // --- Night Rush Slot (09:00 PM - 11:00 PM) ---
      { name: 'Swiggy Rider #88', type: 'ONLINE', isPrinted: true, hoursAgo: 0.9, items: [{ item: menuItems[1], qty: 2 }] }, // ₹300 (Billed)
      { name: 'Walk-in Cash #13', type: 'CASH', isPrinted: false, hoursAgo: 0.7, items: [{ item: menuItems[0], qty: 2 }] }, // ₹240 (Unprinted)
      { name: 'Walk-in Cash #14', type: 'CASH', isPrinted: false, hoursAgo: 0.5, items: [{ item: menuItems[2] || menuItems[0], qty: 2 }] }, // ₹360 (Unprinted)
      { name: 'Counter UPI (GPay)', type: 'UPI', isPrinted: true, hoursAgo: 0.3, items: [{ item: menuItems[0], qty: 2 }] }, // ₹240 (Billed)
      { name: 'Walk-in Cash #15', type: 'CASH', isPrinted: false, hoursAgo: 0.2, items: [{ item: menuItems[1], qty: 2 }] }, // ₹300 (Unprinted)
      { name: 'Walk-in Cash #16', type: 'CASH', isPrinted: false, hoursAgo: 0.1, items: [{ item: menuItems[0], qty: 2 }] }, // ₹240 (Unprinted)
    ];

    let kotNum = 1;
    let invNum = 1;
    let totalSales = 0;
    let printedSales = 0;

    for (let i = 0; i < ordersToSeed.length; i++) {
      const order = ordersToSeed[i];
      const kotNumber = `KOT #${kotNum++}`;
      const orderTime = new Date(Date.now() - order.hoursAgo * 3600 * 1000);

      const subtotal = order.items.reduce((sum, itemRow) => {
        return sum + (Number(itemRow.item.price) * itemRow.qty);
      }, 0);

      totalSales += subtotal;
      if (order.isPrinted) printedSales += subtotal;

      const billNumber = order.isPrinted
        ? `INV-KIRTI-${String(invNum++).padStart(3, '0')}`
        : `DRAFT-${Math.random().toString(36).substring(7).toUpperCase()}`;

      await prisma.bill.create({
        data: {
          outletId: outlet.id,
          posDeviceId: posDevice.id,
          billNumber,
          status: order.isPrinted ? BillStatus.FINALIZED : BillStatus.HELD,
          customerName: order.name,
          subtotal,
          taxAmount: 0,
          discount: 0,
          total: subtotal,
          isPrinted: order.isPrinted,
          printedAt: order.isPrinted ? orderTime : null,
          finalizedAt: order.isPrinted ? orderTime : null,
          businessDayId: activeDay.id,
          createdAt: orderTime,
          items: {
            create: order.items.map((i) => ({
              itemId: i.item.itemId,
              name: i.item.item.name,
              quantity: i.qty,
              unitPrice: i.item.price,
              total: Number(i.item.price) * i.qty,
            })),
          },
          payments: {
            create: {
              method: order.type === 'ONLINE' ? PaymentMethod.ONLINE : (order.type === 'UPI' ? PaymentMethod.UPI : PaymentMethod.CASH),
              amount: subtotal,
              createdAt: orderTime,
            },
          },
        },
      });

      console.log(`   [${String(i + 1).padStart(2, '0')}/24] ${order.name.padEnd(22)} | ${kotNumber.padEnd(8)} | ${order.type.padEnd(6)} | ₹${subtotal.toString().padEnd(4)} | ${order.isPrinted ? `Billed (${billNumber})` : 'Unprinted (KOT Only)'}`);
    }

    const target70 = Math.ceil(totalSales * 0.7);
    const deficit = Math.max(0, target70 - printedSales);
    const ratio = ((printedSales / totalSales) * 100).toFixed(1);

    console.log(`\n========================================================================`);
    console.log(`📊 FRESH SHIFT STATUS (READY FOR TIME-SLOT SPLITTING TEST):`);
    console.log(`========================================================================`);
    console.log(`   - Total Shift Sales: ₹${totalSales.toLocaleString('en-IN')}`);
    console.log(`   - 70% Target Needed: ₹${target70.toLocaleString('en-IN')}`);
    console.log(`   - Already Printed:   ₹${printedSales.toLocaleString('en-IN')} (${ratio}%)`);
    console.log(`   - Deficit to Print:  ₹${deficit.toLocaleString('en-IN')} (Printing Required!)`);
    console.log(`   - Unprinted KOTs:    16 orders available across 4 time slots`);
    console.log(`------------------------------------------------------------------------`);
    console.log(`🖥️ Test on POS screen:`);
    console.log(`   1. Open POS -> Click "End Day & Close Shift"`);
    console.log(`   2. Modal will say: "₹${deficit.toLocaleString('en-IN')} amount of bill printing is left to print."`);
    console.log(`   3. Click "Go to Print Page" to see the time-slot splitting & batch printer!`);
    console.log(`========================================================================\n`);

  } catch (error) {
    console.error('❌ Error resetting and seeding Kirti shift:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetAndSeedKirtiUnprinted();
