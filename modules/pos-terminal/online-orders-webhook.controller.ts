import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { PosTerminalService } from './pos-terminal.service';

@Controller('pos-terminal/webhooks')
export class OnlineOrdersWebhookController {
  constructor(private readonly posTerminalService: PosTerminalService) {}

  @Post('zomato')
  @HttpCode(HttpStatus.OK)
  async handleZomatoWebhook(@Body() payload: any) {
    // Zomato POS Order Relay Webhook Endpoint
    // Zomato sends: store_id, order_id, customer_name, customer_phone, items, total_amount
    console.log('📦 Received Zomato POS Webhook Payload:', JSON.stringify(payload));
    return this.posTerminalService.processOnlineWebhookOrder({
      source: 'ZOMATO',
      rawPayload: payload,
    });
  }

  @Post('swiggy')
  @HttpCode(HttpStatus.OK)
  async handleSwiggyWebhook(@Body() payload: any) {
    // Swiggy POS Order Relay Webhook Endpoint
    // Swiggy sends: store_id, order_id, customer_name, customer_phone, items, total_amount
    console.log('📦 Received Swiggy POS Webhook Payload:', JSON.stringify(payload));
    return this.posTerminalService.processOnlineWebhookOrder({
      source: 'SWIGGY',
      rawPayload: payload,
    });
  }

  @Post('urbanpiper')
  @HttpCode(HttpStatus.OK)
  async handleUrbanpiperWebhook(@Body() payload: any) {
    // UrbanPiper Hub API Order Relay Webhook Endpoint
    // UrbanPiper aggregates Zomato & Swiggy orders into single unified webhook
    console.log('📦 Received UrbanPiper Webhook Payload:', JSON.stringify(payload));
    return this.posTerminalService.processOnlineWebhookOrder({
      source: payload?.order?.details?.channel?.toUpperCase() || 'URBANPIPER',
      rawPayload: payload,
    });
  }
}
