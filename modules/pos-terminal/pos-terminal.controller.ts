import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { CurrentPosSession } from '../pos-auth/decorators/current-pos-session.decorator';
import { PosAuthGuard } from '../pos-auth/guards/pos-auth.guard';
import { PosSession } from '../pos-auth/pos-session.type';
import { AddBillItemsDto } from './dto/add-bill-items.dto';
import { CancelBillDto } from './dto/cancel-bill.dto';
import { CreateBillDto } from './dto/create-bill.dto';
import { CreateKotDto } from './dto/create-kot.dto';
import { FinalizeBillDto } from './dto/finalize-bill.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { PosTerminalService } from './pos-terminal.service';

@Controller('pos-terminal')
@UseGuards(PosAuthGuard)
export class PosTerminalController {
  constructor(private readonly posTerminalService: PosTerminalService) {}

  @Get('me')
  me(@CurrentPosSession() session: PosSession) {
    return this.posTerminalService.me(session);
  }

  @Get('menu')
  menu(@CurrentPosSession() session: PosSession) {
    return this.posTerminalService.menu(session);
  }

  // ─── Business Day ──────────────────────────────────────────────────────────

  @Get('day/current')
  getDayStatus(@CurrentPosSession() session: PosSession) {
    return this.posTerminalService.currentDay(session);
  }

  // ──────────────────────────────────────────────────────────────────────────


  @Get('bills/held')
  heldBills(@CurrentPosSession() session: PosSession) {
    return this.posTerminalService.heldBills(session);
  }

  @Get('bills')
  bills(@CurrentPosSession() session: PosSession) {
    return this.posTerminalService.bills(session);
  }

  @Get('kots')
  kotTickets(@CurrentPosSession() session: PosSession) {
    return this.posTerminalService.kotTickets(session);
  }

  @Post('bills')
  createBill(@CurrentPosSession() session: PosSession, @Body() dto: CreateBillDto) {
    return this.posTerminalService.createBill(session, dto);
  }

  @Patch('bills/:id/items')
  addItems(
    @CurrentPosSession() session: PosSession,
    @Param('id') id: string,
    @Body() dto: AddBillItemsDto,
  ) {
    return this.posTerminalService.addItems(session, id, dto);
  }

  @Post('bills/:id/kot')
  createKot(
    @CurrentPosSession() session: PosSession,
    @Param('id') id: string,
    @Body() dto: CreateKotDto,
  ) {
    return this.posTerminalService.createKot(session, id, dto);
  }

  @Patch('bills/:id/finalize')
  finalizeBill(
    @CurrentPosSession() session: PosSession,
    @Param('id') id: string,
    @Body() dto: FinalizeBillDto,
  ) {
    return this.posTerminalService.finalizeBill(session, id, dto);
  }

  @Patch('bills/:id/cancel')
  cancelBill(
    @CurrentPosSession() session: PosSession,
    @Param('id') id: string,
    @Body() dto: CancelBillDto,
  ) {
    return this.posTerminalService.cancelBill(session, id, dto);
  }

  @Get('orders')
  digitalOrders(@CurrentPosSession() session: PosSession) {
    return this.posTerminalService.digitalOrders(session);
  }

  @Patch('orders/:id/status')
  updateOrderStatus(
    @CurrentPosSession() session: PosSession,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.posTerminalService.updateOrderStatus(session, id, dto);
  }

  @Post('orders/:id/accept')
  acceptDigitalOrder(
    @CurrentPosSession() session: PosSession,
    @Param('id') id: string,
    @Body() body?: { driverId?: string; driverName?: string; driverPhone?: string },
  ) {
    return this.posTerminalService.acceptDigitalOrder(session, id, body);
  }

  @Get('delivery-orders/:id')
  getDeliveryOrderDetails(@Param('id') id: string) {
    return this.posTerminalService.getDeliveryOrderDetails(id);
  }

  @Patch('delivery-orders/:id/status')
  updateDeliveryStatus(@Param('id') id: string, @Body('deliveryStatus') deliveryStatus: string) {
    return this.posTerminalService.updateDeliveryStatus(id, deliveryStatus);
  }

  @Get('shift-summary')
  shiftSummary(@CurrentPosSession() session: PosSession) {
    return this.posTerminalService.shiftSummary(session);
  }

  @Get('team-members')
  teamMembers(@CurrentPosSession() session: PosSession) {
    return this.posTerminalService.teamMembers(session);
  }

  @Post('shift/start')
  startDay(@CurrentPosSession() session: PosSession, @Body('openingFloat') openingFloat?: number) {
    return this.posTerminalService.startDay(session, openingFloat ?? 0);
  }

  @Post('shift/end')
  endDay(@CurrentPosSession() session: PosSession, @Body('closingNotes') closingNotes?: string) {
    return this.posTerminalService.endDay(session, closingNotes);
  }

  @Get('settings')
  getSettings(@CurrentPosSession() session: PosSession) {
    return this.posTerminalService.getSettings(session);
  }

  @Patch('settings/printer')
  updatePrinterSettings(
    @CurrentPosSession() session: PosSession,
    @Body() body: { printerName?: string; printerIp?: string; paperWidth?: string },
  ) {
    return this.posTerminalService.updatePrinterSettings(session, body);
  }

  @Patch('settings/2fa')
  toggle2FA(
    @CurrentPosSession() session: PosSession,
    @Body('enabled') enabled: boolean,
  ) {
    return this.posTerminalService.toggle2FA(session, enabled ?? true);
  }

  @Get('item-channels')
  getItemChannels(@CurrentPosSession() session: PosSession) {
    return this.posTerminalService.getItemChannels(session);
  }

  @Patch('item-channels/:id')
  updateItemChannel(
    @CurrentPosSession() session: PosSession,
    @Param('id') id: string,
    @Body() body: { channel: string; enabled: boolean },
  ) {
    return this.posTerminalService.updateItemChannel(session, id, body);
  }

  @Get('gst-compliance/unprinted-bills')
  getUnprintedBills(@CurrentPosSession() session: PosSession) {
    return this.posTerminalService.getUnprintedBills(session);
  }

  @Post('gst-compliance/batch-print')
  batchPrintComplianceBills(
    @CurrentPosSession() session: PosSession,
    @Body('billIds') billIds: string[],
  ) {
    return this.posTerminalService.batchPrintComplianceBills(session, billIds || []);
  }
}


