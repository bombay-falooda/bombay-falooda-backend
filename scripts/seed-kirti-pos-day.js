const { PrismaClient, BillStatus, OrderSource, PaymentMethod, BusinessDayStatus, OutletStatus, PosDeviceType, PosDeviceStatus, MenuSetupStatus } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function seedKirtiPosDay() {
  console.log('========================================================================');
  console.log('🍨 BOMBAY FALOODA — POPULATING REALISTIC SHIFT FOR KIRTI OUTLET POS');
  console.log('========================================================================\n');

  try {
    // 1. Locate or create Kirti Outlet
    let outlet = await prisma.outlet.findFirst({
      where: {
        OR: [
          { code: { contains: 'KIRTI', mode: 'insensitive' } },
          { name: { contains: 'Kirti', mode: 'insensitive' } },
          { code: 'BF-DEMO-001' },
        ],
      },
      include: { franchise: true },
    });

    if (!outlet) {
      console.log('⚙️ Kirti outlet not found, creating outlet record...');
      let franchise = await prisma.franchise.findFirst();
      if (!franchise) {
        franchise = await prisma.franchise.create({
          data: {
            name: 'Bombay Falooda Head Franchise',
            ownerName: 'Saher Bhai',
            email: 'admin@bombayfalooda.com',
            phone: '9898000000',
            address: 'Kirtistambh',
            city: 'Vadodara',
            state: 'Gujarat',
          },
        });
      }

      outlet = await prisma.outlet.create({
        data: {
          franchiseId: franchise.id,
          name: 'Kirtistambh Outlet',
          code: 'OLT-KIRTI-01',
          address: 'Near Kirtistambh, Vadodara',
          phone: '9898111111',
          email: 'kirti@bombayfalooda.com',
          status: OutletStatus.ACTIVE,
          menuSetupStatus: MenuSetupStatus.PUBLISHED,
        },
        include: { franchise: true },
      });
    }

    console.log(`📍 Outlet: ${outlet.name} (Code: ${outlet.code})`);

    // 2. Locate or upsert the exact POS Device
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
      console.log('🖥️ Creating POS Device for KIRTI-OLT-POS-01...');
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
      posDevice = await prisma.posDevice.update({
        where: { id: posDevice.id },
        data: {
          accessKey: 'POS-A92733A9ADCD',
          deviceCode: 'KIRTI-OLT-POS-01',
          pinHash,
          status: PosDeviceStatus.ACTIVE,
        },
      });
    }

    console.log(`🖥️ POS Terminal Ready: ${posDevice.name}`);
    console.log(`   - Device Code: ${posDevice.deviceCode}`);
    console.log(`   - Access Key:  ${posDevice.accessKey}`);
    console.log(`   - Login PIN:   0502\n`);

    // 3. Ensure menu items are mapped to this outlet
    const catalogItems = await prisma.menuItem.findMany({ where: { isActive: true }, take: 15 });
    if (!catalogItems.length) {
      console.error('❌ No catalog items found. Please run seed-menu first.');
      return;
    }

    for (const item of catalogItems) {
      await prisma.outletMenuItem.upsert({
        where: { outletId_itemId: { outletId: outlet.id, itemId: item.id } },
        update: { isActive: true, price: item.basePrice },
        create: {
          outletId: outlet.id,
          itemId: item.id,
          price: item.basePrice,
          isActive: true,
        },
      });
    }

    const menuItems = await prisma.outletMenuItem.findMany({
      where: { outletId: outlet.id, isActive: true },
      include: { item: true },
    });

    console.log(`📋 Verified ${menuItems.length} active Falooda & Kulfi items for Kirti Outlet.`);

    // 4. Open an active Shift / Business Day for today
    let activeDay = await prisma.outletBusinessDay.findFirst({
      where: { outletId: outlet.id, status: BusinessDayStatus.OPEN },
      orderBy: { startedAt: 'desc' },
    });

    if (!activeDay) {
      activeDay = await prisma.outletBusinessDay.create({
        data: {
          outletId: outlet.id,
          posDeviceId: posDevice.id,
          status: BusinessDayStatus.OPEN,
          startedAt: new Date(Date.now() - 10 * 3600 * 1000), // Opened 10 hours ago
        },
      });
      console.log(`🌅 Opened new shift for today (Shift ID: ${activeDay.id.slice(0, 8)}...)`);
    } else {
      console.log(`🌅 Using current active shift (Shift ID: ${activeDay.id.slice(0, 8)}...)`);
    }

    // 5. Generate Realistic Orders totaling > ₹5,000 (around ₹6,800)
    console.log('\n📦 Feeding realistic Bombay Falooda orders throughout the day:');

    const sampleOrders = [
      // Morning Slot (10:00 AM - 01:00 PM)
      { type: 'CASH', name: 'Counter Cash #1', items: [{ item: menuItems[0], qty: 2 }], isPrinted: false, hoursAgo: 9.5 },
      { type: 'ONLINE', name: 'Zomato Rider #12', items: [{ item: menuItems[1], qty: 2 }, { item: menuItems[2], qty: 1 }], isPrinted: true, hoursAgo: 9.0 },
      { type: 'UPI', name: 'GPay Counter #1', items: [{ item: menuItems[3] || menuItems[0], qty: 2 }], isPrinted: true, hoursAgo: 8.5 },
      { type: 'CASH', name: 'Counter Cash #2', items: [{ item: menuItems[2], qty: 1 }], isPrinted: false, hoursAgo: 8.0 },
      { type: 'ONLINE', name: 'Swiggy Rider #45', items: [{ item: menuItems[0], qty: 3 }], isPrinted: true, hoursAgo: 7.5 },
      { type: 'CASH', name: 'Counter Cash #3', items: [{ item: menuItems[1], qty: 2 }], isPrinted: false, hoursAgo: 7.0 },

      // Afternoon Slot (01:00 PM - 05:00 PM)
      { type: 'CASH', name: 'Counter Cash #4', items: [{ item: menuItems[0], qty: 2 }], isPrinted: false, hoursAgo: 6.0 },
      { type: 'UPI', name: 'PhonePe Counter #2', items: [{ item: menuItems[1], qty: 2 }, { item: menuItems[2], qty: 2 }], isPrinted: true, hoursAgo: 5.5 },
      { type: 'ONLINE', name: 'Website Order #88', items: [{ item: menuItems[2], qty: 3 }], isPrinted: true, hoursAgo: 5.0 },
      { type: 'CASH', name: 'Counter Cash #5', items: [{ item: menuItems[0], qty: 1 }], isPrinted: false, hoursAgo: 4.5 },
      { type: 'CASH', name: 'Counter Cash #6', items: [{ item: menuItems[1], qty: 2 }], isPrinted: false, hoursAgo: 4.0 },

      // Evening Rush Slot (05:00 PM - 09:00 PM)
      { type: 'ONLINE', name: 'Zomato Rider #99', items: [{ item: menuItems[0], qty: 2 }, { item: menuItems[1], qty: 2 }], isPrinted: true, hoursAgo: 3.5 },
      { type: 'UPI', name: 'Paytm Counter #3', items: [{ item: menuItems[2], qty: 2 }], isPrinted: true, hoursAgo: 3.0 },
      { type: 'CASH', name: 'Counter Cash #7', items: [{ item: menuItems[0], qty: 2 }], isPrinted: false, hoursAgo: 2.5 },
      { type: 'CASH', name: 'Counter Cash #8', items: [{ item: menuItems[1], qty: 3 }], isPrinted: false, hoursAgo: 2.0 },
      { type: 'ONLINE', name: 'Swiggy Rider #82', items: [{ item: menuItems[2], qty: 2 }], isPrinted: true, hoursAgo: 1.5 },
      { type: 'UPI', name: 'GPay Counter #4', items: [{ item: menuItems[0], qty: 2 }, { item: menuItems[1], qty: 1 }], isPrinted: true, hoursAgo: 1.0 },

      // Night Rush Slot (09:00 PM - 11:00 PM)
      { type: 'CASH', name: 'Counter Cash #9', items: [{ item: menuItems[0], qty: 2 }], isPrinted: false, hoursAgo: 0.8 },
      { type: 'CASH', name: 'Counter Cash #10', items: [{ item: menuItems[1], qty: 2 }], isPrinted: false, hoursAgo: 0.6 },
      { type: 'CASH', name: 'Counter Cash #11', items: [{ item: menuItems[2], qty: 2 }], isPrinted: false, hoursAgo: 0.4 },
      { type: 'CASH', name: 'Counter Cash #12', items: [{ item: menuItems[0], qty: 2 }, { item: menuItems[1], qty: 2 }], isPrinted: false, hoursAgo: 0.2 },
      { type: 'CASH', name: 'Counter Cash #13', items: [{ item: menuItems[1], qty: 2 }], isPrinted: false, hoursAgo: 0.1 },
    ];

    // Find the current invoice count for Kirti Outlet
    const currentInvoiceCount = await prisma.bill.count({
      where: { outletId: outlet.id, isPrinted: true },
    });

    let nextInvoiceNum = currentInvoiceCount + 1;
    let kotCounter = 1;
    const created = [];

    for (let i = 0; i < sampleOrders.length; i++) {
      const order = sampleOrders[i];
      const kotNumber = `KOT #${kotCounter++}`;
      const orderTime = new Date(Date.now() - order.hoursAgo * 3600 * 1000);
      
      const subtotal = order.items.reduce((sum, itemRow) => {
        return sum + (Number(itemRow.item.price) * itemRow.qty);
      }, 0);

      const isPrinted = order.isPrinted;
      const billNumber = isPrinted 
        ? `INV-KIRTI-${String(nextInvoiceNum++).padStart(3, '0')}`
        : `DRAFT-${Math.random().toString(36).substring(7).toUpperCase()}`;

      const bill = await prisma.bill.create({
        data: {
          outletId: outlet.id,
          posDeviceId: posDevice.id,
          billNumber,
          status: isPrinted ? BillStatus.FINALIZED : BillStatus.HELD,
          customerName: order.name,
          subtotal,
          taxAmount: 0,
          discount: 0,
          total: subtotal,
          isPrinted,
          printedAt: isPrinted ? orderTime : null,
          finalizedAt: isPrinted ? orderTime : null,
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
        include: { items: true, payments: true },
      });

      console.log(`   [${String(i + 1).padStart(2, '0')}/${sampleOrders.length}] ${order.name.padEnd(22)} | ${kotNumber.padEnd(8)} | ${order.type.padEnd(6)} | ₹${subtotal.toString().padEnd(4)} | ${isPrinted ? `Auto-Billed (${billNumber})` : 'KOT Slip'}`);
      created.push(bill);
    }

    // 6. Perform Auto-Balancing to ensure 70% Compliance
    const totalDaySales = created.reduce((sum, b) => sum + Number(b.total), 0);
    const initiallyPrinted = created.filter((b) => b.isPrinted);
    const initiallyPrintedAmount = initiallyPrinted.reduce((sum, b) => sum + Number(b.total), 0);
    const target70Percent = Math.round(totalDaySales * 0.70);
    const deficit = Math.max(0, target70Percent - initiallyPrintedAmount);

    console.log(`\n📊 Day Status for KIRTI-OLT-POS-01:`);
    console.log(`   - Total Shift Sales:   ₹${totalDaySales.toLocaleString('en-IN')} (Average > ₹5,000 threshold passed)`);
    console.log(`   - 70% GST Target:      ₹${target70Percent.toLocaleString('en-IN')}`);
    console.log(`   - Already Billed (UPI/Online): ₹${initiallyPrintedAmount.toLocaleString('en-IN')} (${((initiallyPrintedAmount / totalDaySales) * 100).toFixed(1)}%)`);
    console.log(`   - Quota Deficit:       ₹${deficit.toLocaleString('en-IN')}`);

    if (deficit > 0) {
      console.log(`\n⚡ Applying 70% Auto-Balancing for Kirti Register:`);
      const unprinted = created.filter((b) => !b.isPrinted).sort((a, b) => a.createdAt - b.createdAt);
      let balanceCovered = 0;
      let balancedBillsCount = 0;

      for (const bill of unprinted) {
        if (balanceCovered < deficit) {
          const assignedInv = `INV-KIRTI-${String(nextInvoiceNum++).padStart(3, '0')}`;
          await prisma.bill.update({
            where: { id: bill.id },
            data: {
              billNumber: assignedInv,
              isPrinted: true,
              printedAt: bill.createdAt,
              status: BillStatus.FINALIZED,
              finalizedAt: bill.createdAt,
            },
          });
          bill.billNumber = assignedInv;
          bill.isPrinted = true;
          balanceCovered += Number(bill.total);
          balancedBillsCount++;
        }
      }
      console.log(`   - Automatically finalized ${balancedBillsCount} cash orders totaling ₹${balanceCovered} to hit 70%.`);
    }

    // 7. Verification Summary
    const finalShiftBills = await prisma.bill.findMany({
      where: { businessDayId: activeDay.id },
      orderBy: { createdAt: 'asc' },
    });

    const finalBilled = finalShiftBills.filter((b) => b.isPrinted);
    const finalBilledTotal = finalBilled.reduce((sum, b) => sum + Number(b.total), 0);
    const finalUnbilled = finalShiftBills.filter((b) => !b.isPrinted);
    const finalUnbilledTotal = finalUnbilled.reduce((sum, b) => sum + Number(b.total), 0);

    console.log(`\n========================================================================`);
    console.log(`✅ POPULATION COMPLETE & READY FOR POS LOGIN`);
    console.log(`========================================================================`);
    console.log(`🖥️ POS Login Credentials:`);
    console.log(`   - Device Code: KIRTI-OLT-POS-01`);
    console.log(`   - Access Key:  POS-A92733A9ADCD`);
    console.log(`   - PIN:         0502`);
    console.log(`------------------------------------------------------------------------`);
    console.log(`📈 Shift Summary on Screen:`);
    console.log(`   - Total Orders:      ${finalShiftBills.length} orders (KOT #1 to KOT #${sampleOrders.length})`);
    console.log(`   - Total Shift Sales: ₹${totalDaySales.toLocaleString('en-IN')}`);
    console.log(`   - Official Billed:   ₹${finalBilledTotal.toLocaleString('en-IN')} (${((finalBilledTotal / totalDaySales) * 100).toFixed(1)}%)`);
    console.log(`   - Billed Invoices:   ${finalBilled.length} consecutive bills (${finalBilled[0]?.billNumber} to ${finalBilled[finalBilled.length - 1]?.billNumber})`);
    console.log(`   - Unbilled KOTs:     ${finalUnbilled.length} orders (₹${finalUnbilledTotal.toLocaleString('en-IN')})`);
    console.log(`========================================================================\n`);

  } catch (error) {
    console.error('❌ Error populating Kirti POS shift:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedKirtiPosDay();
