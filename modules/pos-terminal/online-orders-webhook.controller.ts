import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { PosTerminalService } from './pos-terminal.service';

@Controller('pos-terminal/webhooks')
export class OnlineOrdersWebhookController {
  private readonly logger = new Logger(OnlineOrdersWebhookController.name);

  constructor(private readonly posTerminalService: PosTerminalService) {}

  /**
   * 1. UNIVERSAL ZOMATO WEBHOOK ENDPOINT
   * Single URL that can receive ANY Zomato event (Order Relay, Status, Rider, Cancellation, Complaints, Ratings)
   */
  @Post('zomato')
  @HttpCode(HttpStatus.OK)
  async handleZomatoUniversalWebhook(@Body() payload: any) {
    this.logger.log(`📦 [Zomato Universal Webhook] Payload: ${JSON.stringify(payload)}`);
    try {
      return await this.posTerminalService.handleZomatoWebhookUniversal(payload);
    } catch (err: any) {
      this.logger.error(`❌ [Zomato Webhook Error] ${err?.message || err}`);
      // Always return 200 OK so Zomato does not spam retries, while returning structured error info
      return { status: 'error', message: err?.message || 'Failed to process webhook payload' };
    }
  }

  /**
   * 2. DEDICATED ZOMATO ORDER RELAY WEBHOOK
   * Specifically for receiving new incoming orders
   */
  @Post('zomato/order-relay')
  @HttpCode(HttpStatus.OK)
  async handleZomatoOrderRelay(@Body() payload: any) {
    this.logger.log(`📦 [Zomato Order Relay] Payload: ${JSON.stringify(payload)}`);
    try {
      return await this.posTerminalService.processOnlineWebhookOrder({
        source: 'ZOMATO',
        rawPayload: payload,
      });
    } catch (err: any) {
      this.logger.error(`❌ [Zomato Order Relay Error] ${err?.message || err}`);
      return { status: 'error', message: err?.message || 'Error processing order relay' };
    }
  }

  /**
   * 3. DEDICATED ZOMATO ORDER STATUS UPDATE WEBHOOK
   * Rejections, cancellations, timeouts
   */
  @Post('zomato/order-status')
  @HttpCode(HttpStatus.OK)
  async handleZomatoOrderStatus(@Body() payload: any) {
    this.logger.log(`⚠️ [Zomato Order Status] Payload: ${JSON.stringify(payload)}`);
    return this.posTerminalService.handleZomatoOrderStatusUpdate(payload);
  }

  /**
   * 4. DEDICATED ZOMATO DELIVERY PARTNER (RIDER) STATUS WEBHOOK
   * Rider assigned, arrived, picked up
   */
  @Post('zomato/rider-status')
  @HttpCode(HttpStatus.OK)
  async handleZomatoRiderStatus(@Body() payload: any) {
    this.logger.log(`🛵 [Zomato Rider Status] Payload: ${JSON.stringify(payload)}`);
    return this.posTerminalService.handleZomatoRiderStatusUpdate(payload);
  }

  /**
   * 5. DEDICATED ZOMATO MERCHANT AGREED CANCELLATION (MAC) WEBHOOK
   */
  @Post('zomato/cancellation')
  @HttpCode(HttpStatus.OK)
  async handleZomatoCancellation(@Body() payload: any) {
    this.logger.log(`🚨 [Zomato MAC Cancellation] Payload: ${JSON.stringify(payload)}`);
    return this.posTerminalService.handleZomatoCancellation(payload);
  }

  /**
   * 6. DEDICATED ZOMATO COMPLAINTS WEBHOOK
   */
  @Post('zomato/complaints')
  @HttpCode(HttpStatus.OK)
  async handleZomatoComplaints(@Body() payload: any) {
    this.logger.log(`📝 [Zomato Complaint] Payload: ${JSON.stringify(payload)}`);
    return this.posTerminalService.handleZomatoComplaint(payload);
  }

  /**
   * 7. DEDICATED ZOMATO RATINGS WEBHOOK
   */
  @Post('zomato/ratings')
  @HttpCode(HttpStatus.OK)
  async handleZomatoRatings(@Body() payload: any) {
    this.logger.log(`⭐ [Zomato Rating] Payload: ${JSON.stringify(payload)}`);
    return this.posTerminalService.handleZomatoRating(payload);
  }

  /**
   * 8. SWIGGY WEBHOOK ENDPOINT
   */
  @Post('swiggy')
  @HttpCode(HttpStatus.OK)
  async handleSwiggyWebhook(@Body() payload: any) {
    this.logger.log(`📦 [Swiggy POS Webhook] Payload: ${JSON.stringify(payload)}`);
    try {
      return await this.posTerminalService.processOnlineWebhookOrder({
        source: 'SWIGGY',
        rawPayload: payload,
      });
    } catch (err: any) {
      this.logger.error(`❌ [Swiggy Webhook Error] ${err?.message || err}`);
      return { status: 'error', message: err?.message || 'Error processing Swiggy webhook' };
    }
  }

  /**
   * 9. URBANPIPER WEBHOOK ENDPOINT
   */
  @Post('urbanpiper')
  @HttpCode(HttpStatus.OK)
  async handleUrbanpiperWebhook(@Body() payload: any) {
    this.logger.log(`📦 [UrbanPiper Webhook] Payload: ${JSON.stringify(payload)}`);
    try {
      return await this.posTerminalService.processOnlineWebhookOrder({
        source: payload?.order?.details?.channel?.toUpperCase() || 'URBANPIPER',
        rawPayload: payload,
      });
    } catch (err: any) {
      this.logger.error(`❌ [UrbanPiper Webhook Error] ${err?.message || err}`);
      return { status: 'error', message: err?.message || 'Error processing UrbanPiper webhook' };
    }
  }
}
