import { Controller, Get, Patch, Param, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('feed')
  getFeed(
    @Query('role') role?: string,
    @Query('outletId') outletId?: string,
    @Query('franchiseId') franchiseId?: string,
  ) {
    return this.notificationsService.getNotifications(role, outletId, franchiseId);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Patch('read-all')
  markAllRead(
    @Query('role') role?: string,
    @Query('outletId') outletId?: string,
  ) {
    return this.notificationsService.markAllAsRead(role, outletId);
  }

  @Get('test-firebase')
  testFirebase() {
    return this.notificationsService.getFirebaseStatus();
  }
}
