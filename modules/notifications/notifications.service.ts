import { Injectable } from '@nestjs/common';
import { PrismaService } from '@app/database';

export type CreateNotificationParams = {
  recipientRole?: 'SUPERADMIN' | 'FRANCHISE_OWNER' | 'ALL';
  outletId?: string;
  franchiseId?: string;
  title: string;
  message: string;
  type?: 'SUCCESS' | 'INFO' | 'WARNING' | 'ALERT';
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return this.prisma;
  }

  async createNotification(params: CreateNotificationParams) {
    const notification = await this.db.notificationLog.create({
      data: {
        recipientRole: params.recipientRole || 'FRANCHISE_OWNER',
        outletId: params.outletId,
        franchiseId: params.franchiseId,
        title: params.title,
        message: params.message,
        type: params.type || 'INFO',
      },
    });
    return notification;
  }

  async getNotifications(role?: string, outletId?: string, franchiseId?: string) {
    const where: any = {};

    if (role === 'SUPERADMIN') {
      where.OR = [
        { recipientRole: 'SUPERADMIN' },
        { recipientRole: 'ALL' },
      ];
    } else if (role === 'FRANCHISE_OWNER') {
      const filters: any[] = [{ recipientRole: 'FRANCHISE_OWNER' }, { recipientRole: 'ALL' }];
      if (outletId) filters.push({ outletId });
      if (franchiseId) filters.push({ franchiseId });
      where.OR = filters;
    }

    return this.db.notificationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(id: string) {
    return this.db.notificationLog.update({
      where: { id },
      data: { readStatus: true },
    });
  }

  async markAllAsRead(role?: string, outletId?: string) {
    const where: any = {};
    if (role) where.recipientRole = role;
    if (outletId) where.outletId = outletId;

    await this.db.notificationLog.updateMany({
      where,
      data: { readStatus: true },
    });

    return { success: true, message: 'All notifications marked as read' };
  }
}
