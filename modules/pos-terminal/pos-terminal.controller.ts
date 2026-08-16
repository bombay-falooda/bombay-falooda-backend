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
  ) {
    return this.posTerminalService.acceptDigitalOrder(session, id);
  }

  @Get('shift-summary')
  shiftSummary(@CurrentPosSession() session: PosSession) {
    return this.posTerminalService.shiftSummary(session);
  }
}
