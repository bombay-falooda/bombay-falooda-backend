import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SwiggyIntegrationService {
  private readonly logger = new Logger(SwiggyIntegrationService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    // Configurable for sandbox or production Swiggy API
    this.baseUrl =
      this.configService.get<string>('SWIGGY_API_BASE_URL') ||
      'https://partner.swiggy.com/v1';
    this.apiKey = this.configService.get<string>('SWIGGY_API_KEY') || '';
  }

  /**
   * Helper to perform authenticated HTTP requests to Swiggy API
   */
  private async postRequest(endpoint: string, payload: any): Promise<{ success: boolean; data?: any; error?: string }> {
    const url = `${this.baseUrl}${endpoint}`;
    this.logger.log(`[Swiggy API] Outgoing POST ${url} with payload: ${JSON.stringify(payload)}`);

    if (!this.apiKey) {
      this.logger.warn(`[Swiggy API] No SWIGGY_API_KEY configured. Mocking successful call for ${endpoint}`);
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
        this.logger.error(`[Swiggy API Error] Status ${response.status}: ${JSON.stringify(json)}`);
        return { success: false, error: json.message || `HTTP ${response.status}`, data: json };
      }

      return { success: true, data: json };
    } catch (err: any) {
      this.logger.error(`[Swiggy API Network Error] ${err?.message || err}`);
      return { success: false, error: err?.message || 'Network error' };
    }
  }

  /**
   * Confirm an order relayed to the restaurant POS
   * Doc: /orders/v1/update-status (CONFIRMED)
   */
  async confirmOrder(swiggyOrderId: string, prepTimeMinutes = 15) {
    return this.postRequest('/orders/v1/update-status', {
      order_id: swiggyOrderId,
      status: 'CONFIRMED',
      prep_time: prepTimeMinutes,
    });
  }

  /**
   * Reject an order relayed to the restaurant POS
   * Doc: /orders/v1/update-status (REJECTED)
   */
  async rejectOrder(swiggyOrderId: string, reason = 'Item Out of Stock or Kitchen Busy') {
    return this.postRequest('/orders/v1/update-status', {
      order_id: swiggyOrderId,
      status: 'REJECTED',
      rejection_reason: reason,
    });
  }

  /**
   * Mark an order as Ready for pickup (Notifies Swiggy delivery partner)
   * Doc: /orders/v1/update-status (FOOD_READY)
   */
  async markOrderReady(swiggyOrderId: string) {
    return this.postRequest('/orders/v1/update-status', {
      order_id: swiggyOrderId,
      status: 'FOOD_READY',
    });
  }

  /**
   * Mark an order as Picked Up by delivery partner
   * Doc: /orders/v1/update-status (PICKED_UP)
   */
  async markOrderPickedUp(swiggyOrderId: string) {
    return this.postRequest('/orders/v1/update-status', {
      order_id: swiggyOrderId,
      status: 'PICKED_UP',
    });
  }

  /**
   * Toggle item stock status on Swiggy
   * Doc: /menu/v1/item-toggle
   */
  async updateItemStock(resId: string, itemId: string, inStock: boolean) {
    return this.postRequest('/menu/v1/item-toggle', {
      outlet_id: resId,
      items: [
        {
          item_id: itemId,
          in_stock: inStock,
        },
      ],
    });
  }

  /**
   * Update outlet delivery / serviceability status on Swiggy
   * Doc: /store/v1/status
   */
  async updateDeliveryStatus(resId: string, isDeliveryActive: boolean, reason?: string) {
    return this.postRequest('/store/v1/status', {
      outlet_id: resId,
      store_status: isDeliveryActive ? 'OPEN' : 'CLOSED',
      reason: reason || (isDeliveryActive ? 'Store opened' : 'Store closed temporarily'),
    });
  }
}
