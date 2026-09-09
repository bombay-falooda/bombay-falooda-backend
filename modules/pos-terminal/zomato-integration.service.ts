import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ZomatoIntegrationService {
  private readonly logger = new Logger(ZomatoIntegrationService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    // Configurable for sandbox or production Zomato API
    this.baseUrl =
      this.configService.get<string>('ZOMATO_API_BASE_URL') ||
      'https://api.zomato.com';
    this.apiKey = this.configService.get<string>('ZOMATO_API_KEY') || '';
  }

  /**
   * Helper to perform authenticated HTTP requests to Zomato API
   */
  private async postRequest(endpoint: string, payload: any): Promise<{ success: boolean; data?: any; error?: string }> {
    const url = `${this.baseUrl}${endpoint}`;
    this.logger.log(`[Zomato API] Outgoing POST ${url} with payload: ${JSON.stringify(payload)}`);

    if (!this.apiKey) {
      this.logger.warn(`[Zomato API] No ZOMATO_API_KEY configured. Mocking successful call for ${endpoint}`);
      return { success: true, data: { mock: true, message: 'Mock success (API key not set)' } };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'api-key': this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        this.logger.error(`[Zomato API Error] Status ${response.status}: ${JSON.stringify(json)}`);
        return { success: false, error: json.message || `HTTP ${response.status}`, data: json };
      }

      return { success: true, data: json };
    } catch (err: any) {
      this.logger.error(`[Zomato API Network Error] ${err?.message || err}`);
      return { success: false, error: err?.message || 'Network error' };
    }
  }

  /**
   * Confirm an order relayed to the restaurant POS
   * Doc: /online-ordering/v1/order/confirm
   */
  async confirmOrder(zomatoOrderId: string, prepTimeMinutes = 15) {
    return this.postRequest('/online-ordering/v1/order/confirm', {
      order_id: zomatoOrderId,
      prep_time: prepTimeMinutes,
    });
  }

  /**
   * Reject an order relayed to the restaurant POS
   * Doc: /online-ordering/v1/order/reject
   */
  async rejectOrder(zomatoOrderId: string, reason = 'Item Out of Stock or Kitchen Busy') {
    return this.postRequest('/online-ordering/v1/order/reject', {
      order_id: zomatoOrderId,
      rejection_reason: reason,
    });
  }

  /**
   * Mark an order as Ready for pickup (Notifies delivery partner)
   * Doc: /online-ordering/v1/order/ready
   */
  async markOrderReady(zomatoOrderId: string) {
    return this.postRequest('/online-ordering/v1/order/ready', {
      order_id: zomatoOrderId,
    });
  }

  /**
   * Mark an order as Picked Up by delivery partner
   * Doc: /online-ordering/v1/order/pickedup
   */
  async markOrderPickedUp(zomatoOrderId: string) {
    return this.postRequest('/online-ordering/v1/order/pickedup', {
      order_id: zomatoOrderId,
    });
  }

  /**
   * Toggle item stock status on Zomato
   * Doc: /online-ordering/v3/menu/item/stock
   */
  async updateItemStock(resId: string, itemId: string, inStock: boolean) {
    return this.postRequest('/online-ordering/v3/menu/item/stock', {
      res_id: resId,
      items: [
        {
          item_id: itemId,
          in_stock: inStock,
        },
      ],
    });
  }

  /**
   * Update outlet delivery / serviceability status
   * Doc: /online-ordering/v1/restaurant_delivery_status/update
   */
  async updateDeliveryStatus(resId: string, isDeliveryActive: boolean, reason?: string) {
    return this.postRequest('/online-ordering/v1/restaurant_delivery_status/update', {
      res_id: resId,
      delivery_status: isDeliveryActive ? 'ONLINE' : 'OFFLINE',
      reason: reason || (isDeliveryActive ? 'Store opened' : 'Store closed temporarily'),
    });
  }
}
