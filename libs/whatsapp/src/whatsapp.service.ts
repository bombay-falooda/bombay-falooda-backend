import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  private get phoneNumberId(): string | undefined {
    return process.env.WHATSAPP_PHONE_NUMBER_ID;
  }

  private get accessToken(): string | undefined {
    return process.env.WHATSAPP_ACCESS_TOKEN;
  }

  /**
   * Format phone number to E.164 without + (e.g. 919876543210)
   */
  private formatPhoneNumber(rawPhone: string, defaultCountryCode = '91'): string {
    const cleaned = rawPhone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `${defaultCountryCode}${cleaned}`;
    }
    return cleaned;
  }

  /**
   * Send WhatsApp Login OTP to customer, franchise, or admin
   */
  async sendLoginOtp(rawPhone: string, otpCode: string, recipientName = 'Customer'): Promise<boolean> {
    const toPhone = this.formatPhoneNumber(rawPhone);

    if (!this.phoneNumberId || !this.accessToken) {
      this.logger.warn(
        `[WhatsApp OTP Simulation] WHATSAPP credentials not configured in .env. Target Phone: +${toPhone}, OTP: ${otpCode}`,
      );
      return true; // Graceful dev mode
    }

    const url = `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`;

    // 1. Try Template Message first (Authentication / Utility OTP)
    try {
      const templatePayload = {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'template',
        template: {
          name: 'bombay_falooda_login_otp',
          language: { code: 'en' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: otpCode },
              ],
            },
            {
              type: 'button',
              sub_type: 'url',
              index: '0',
              parameters: [
                { type: 'text', text: otpCode },
              ],
            },
          ],
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templatePayload),
      });

      if (res.ok) {
        this.logger.log(`✅ WhatsApp OTP Template sent to +${toPhone}`);
        return true;
      }

      const resJson = await res.json().catch(() => ({}));
      this.logger.warn(`Template send failed (${JSON.stringify(resJson)}), trying direct text message...`);
    } catch (templateError: any) {
      this.logger.warn(`Template send error: ${templateError?.message}, trying direct text message...`);
    }

    // 2. Fallback to direct session text message
    try {
      const textPayload = {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: `🍨 *Bombay Falooda* Verification Code\n\nYour login OTP is: *${otpCode}*\n\nValid for 5 minutes. Please do not share this code with anyone.`,
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(textPayload),
      });

      if (res.ok) {
        this.logger.log(`✅ WhatsApp direct text OTP sent to +${toPhone}`);
        return true;
      }

      const errData = await res.json().catch(() => ({}));
      this.logger.error(`❌ Failed to send WhatsApp message to +${toPhone}:`, errData);
      return false;
    } catch (textError: any) {
      this.logger.error(`❌ Failed to send WhatsApp message to +${toPhone}:`, textError?.message);
      return false;
    }
  }

  /**
   * Send WhatsApp Order Confirmation
   */
  async sendOrderConfirmation(
    rawPhone: string,
    customerName: string,
    orderNumber: string,
    totalAmount: number,
  ): Promise<boolean> {
    const toPhone = this.formatPhoneNumber(rawPhone);

    if (!this.phoneNumberId || !this.accessToken) {
      this.logger.warn(
        `[WhatsApp Order Simulation] Target Phone: +${toPhone}, Order #${orderNumber}, Amount: ₹${totalAmount}`,
      );
      return true;
    }

    const url = `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`;

    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: {
          preview_url: true,
          body: `🍨 *Bombay Falooda Order Confirmed!*\n\nHi *${customerName}*,\nYour order *#${orderNumber}* for *₹${totalAmount}* has been received and is being prepared!\n\nThank you for choosing Bombay Falooda!`,
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        this.logger.log(`✅ WhatsApp order confirmation sent to +${toPhone}`);
        return true;
      }

      const errData = await res.json().catch(() => ({}));
      this.logger.error('❌ Failed to send WhatsApp order confirmation:', errData);
      return false;
    } catch (err: any) {
      this.logger.error('❌ Failed to send WhatsApp order confirmation:', err?.message);
      return false;
    }
  }
}
