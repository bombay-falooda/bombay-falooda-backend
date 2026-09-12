import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
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
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseApp: App | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.initFirebase();
  }

  private initFirebase() {
    const projectId = process.env.FCM_PROJECT_ID;
    const clientEmail = process.env.FCM_CLIENT_EMAIL;
    let privateKey = process.env.FCM_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('⚠️ Firebase Admin credentials missing in .env. FCM push notifications disabled.');
      return;
    }

    try {
      // Unescape newlines if stored with literal \n
      if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
      }

      if (!getApps().length) {
        this.firebaseApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
        this.logger.log(`🔥 Firebase Admin SDK initialized successfully for project: ${projectId}`);
      } else {
        this.firebaseApp = getApp();
      }
    } catch (err: any) {
      this.logger.error(`❌ Failed to initialize Firebase Admin SDK: ${err?.message || err}`);
    }
  }

  private get db(): any {
    return this.prisma;
  }

  async createNotification(params: CreateNotificationParams) {
    // 1. Save to PostgreSQL audit database
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

    // 2. Dispatch Live Firebase Push Notification
    void this.dispatchFcmPush(params);

    return notification;
  }

  private async dispatchFcmPush(params: CreateNotificationParams) {
    if (!this.firebaseApp) return;

    const topics: string[] = [];

    if (params.recipientRole === 'SUPERADMIN' || params.recipientRole === 'ALL') {
      topics.push('superadmin');
    }
    if (params.franchiseId) {
      topics.push(`franchise_${params.franchiseId}`);
    }
    if (params.outletId) {
      topics.push(`outlet_${params.outletId}`);
    }
    if (params.recipientRole === 'ALL') {
      topics.push('all_staff');
    }

    // Default fallback to superadmin and all_staff if no specific target
    if (topics.length === 0) {
      topics.push('superadmin', 'all_staff');
    }

    const payload = {
      notification: {
        title: params.title,
        body: params.message,
      },
      data: {
        type: params.type || 'INFO',
        outletId: params.outletId || '',
        franchiseId: params.franchiseId || '',
        role: params.recipientRole || 'ALL',
        timestamp: new Date().toISOString(),
      },
      android: {
        priority: 'high' as const,
        notification: {
          sound: 'default',
          channelId: 'bombay_falooda_orders',
        },
      },
      webpush: {
        headers: {
          Urgency: 'high',
        },
        notification: {
          title: params.title,
          body: params.message,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [200, 100, 200],
        },
      },
    };

    for (const topic of topics) {
      try {
        const response = await getMessaging(this.firebaseApp).send({
          topic,
          ...payload,
        });
        this.logger.log(`📢 [FCM Push Sent] Topic: ${topic} | MessageId: ${response}`);
      } catch (err: any) {
        this.logger.warn(`⚠️ [FCM Push Error] Topic ${topic}: ${err?.message || err}`);
      }
    }
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

  getFirebaseStatus() {
    const isReady = Boolean(this.firebaseApp);
    const projectId = process.env.FCM_PROJECT_ID;
    const clientEmail = process.env.FCM_CLIENT_EMAIL;

    return {
      status: isReady ? 'ACTIVE' : 'INCOMPLETE',
      isReady,
      projectId: projectId || 'Not configured',
      clientEmail: clientEmail || 'Not configured',
      message: isReady
        ? 'Firebase Cloud Messaging (FCM) push notifications credentials are valid & initialized in backend.'
        : 'Firebase FCM credentials incomplete in .env',
      timestamp: new Date().toISOString(),
    };
  }
}
