import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '@app/database';

@Injectable()
export class KotPurgeService implements OnModuleInit {
  private readonly logger = new Logger(KotPurgeService.name);
  private purgeInterval: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.logger.log('🛡️ KOT Purge Service initialized (Saher Bhai 60-Day Unbilled KOT Policy)');
    
    // Run initial check on startup
    void this.purgeOldUnbilledKots();

    // Schedule check every 24 hours
    this.purgeInterval = setInterval(() => {
      void this.purgeOldUnbilledKots();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Permanently purges unprinted/unbilled counter KOTs older than 60 days.
   * Finalized, official GST invoices are NEVER touched and remain permanent.
   */
  async purgeOldUnbilledKots(retentionDays = 60) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      this.logger.log(`🔍 Checking for unbilled KOTs older than ${retentionDays} days (Before: ${cutoffDate.toISOString()})...`);

      // Find all unbilled bills older than 60 days
      const oldUnprintedBills = await this.prisma.bill.findMany({
        where: {
          isPrinted: false,
          createdAt: { lt: cutoffDate },
        },
        select: { id: true },
      });

      if (!oldUnprintedBills.length) {
        this.logger.log('✨ No expired unbilled KOTs found to purge. Database is clean.');
        return { purgedCount: 0 };
      }

      const billIds = oldUnprintedBills.map((b) => b.id);

      // Perform cascading deletion
      await this.prisma.$transaction([
        this.prisma.payment.deleteMany({ where: { billId: { in: billIds } } }),
        this.prisma.billItem.deleteMany({ where: { billId: { in: billIds } } }),
        this.prisma.kotTicket.deleteMany({ where: { billId: { in: billIds } } }),
        this.prisma.bill.deleteMany({ where: { id: { in: billIds } } }),
      ]);

      this.logger.log(`🧹 Successfully purged ${billIds.length} expired unbilled KOTs older than ${retentionDays} days.`);
      return { purgedCount: billIds.length };
    } catch (error) {
      this.logger.error('❌ Failed to purge old unbilled KOTs:', error);
      return { purgedCount: 0, error };
    }
  }
}
