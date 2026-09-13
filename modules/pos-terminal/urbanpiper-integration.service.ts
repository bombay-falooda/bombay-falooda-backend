import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface UrbanpiperOrderStatusPayload {
  new_state: 'Acknowledged' | 'Food Ready' | 'Dispatched' | 'Completed' | 'Cancelled';
  message?: string;
}

@Injectable()
export class UrbanpiperIntegrationService {
  private readonly logger = new Logger(UrbanpiperIntegrationService.name);
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    // Staging / Production base URL
    this.baseUrl =
      this.configService.get<string>('URBANPIPER_API_BASE_URL') ||
      'https://api.urbanpiper.com/v1';
    this.username = this.configService.get<string>('URBANPIPER_USERNAME') || '';
    this.apiKey = this.configService.get<string>('URBANPIPER_API_KEY') || '';
  }

  /**
   * Helper to perform authenticated HTTP requests to UrbanPiper REST API
   * Specification: https://developer.urbanpiper.com/docs/api-reference
   */
  private async postRequest(
    endpoint: string,
    payload: any,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const url = `${this.baseUrl}${endpoint}`;
    this.logger.log(`[UrbanPiper API] Outgoing POST ${url} payload: ${JSON.stringify(payload)}`);

    if (!this.apiKey || !this.username) {
      this.logger.warn(`[UrbanPiper API] Credentials not set. Returning mock success for ${endpoint}`);
      return {
        success: true,
        data: { mock: true, message: 'Mock UrbanPiper response (credentials not configured)' },
      };
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `apikey ${this.username}:${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        this.logger.error(`[UrbanPiper Error] HTTP ${response.status}: ${JSON.stringify(json)}`);
        return { success: false, error: json.message || `HTTP ${response.status}`, data: json };
      }

      return { success: true, data: json };
    } catch (err: any) {
      this.logger.error(`[UrbanPiper Network Error] ${err?.message || err}`);
      return { success: false, error: err?.message || 'Network error' };
    }
  }

  /**
   * 1. Acknowledge / Accept Order on UrbanPiper Hub
   * Specification: /orders/{order_id}/status/
   */
  async acknowledgeOrder(orderId: string | number, prepTimeMinutes = 15) {
    return this.postRequest(`/orders/${orderId}/status/`, {
      new_state: 'Acknowledged',
      message: `Order accepted with ${prepTimeMinutes} mins preparation time`,
    });
  }

  /**
   * 2. Mark Order as "Food Ready"
   * Specification: /orders/{order_id}/status/
   */
  async markFoodReady(orderId: string | number) {
    return this.postRequest(`/orders/${orderId}/status/`, {
      new_state: 'Food Ready',
      message: 'Order preparation completed by kitchen',
    });
  }

  /**
   * 3. Mark Order as "Dispatched" / "Picked Up" by Delivery Partner
   * Specification: /orders/{order_id}/status/
   */
  async markDispatched(orderId: string | number) {
    return this.postRequest(`/orders/${orderId}/status/`, {
      new_state: 'Dispatched',
      message: 'Order handed over to delivery executive',
    });
  }

  /**
   * 4. Cancel / Reject Order
   * Specification: /orders/{order_id}/status/
   */
  async cancelOrder(orderId: string | number, reason = 'Kitchen busy / Item unavailable') {
    return this.postRequest(`/orders/${orderId}/status/`, {
      new_state: 'Cancelled',
      message: reason,
    });
  }

  /**
   * 5. Toggle Item Stock Status across Zomato & Swiggy (Satellite 86ing)
   * Specification: /inventory/locations/{location_ref_id}/actions/toggle_stock/
   */
  async updateItemStock(outletRefId: string, itemRefIds: string[], inStock: boolean) {
    return this.postRequest(`/inventory/locations/${outletRefId}/actions/toggle_stock/`, {
      item_ref_ids: itemRefIds,
      action: inStock ? 'enable' : 'disable',
    });
  }

  /**
   * 6. Toggle Store Serviceability (Open / Close Outlet on Zomato & Swiggy)
   * Specification: /stores/{location_ref_id}/status/
   */
  async updateStoreStatus(outletRefId: string, isOpen: boolean, reason?: string) {
    return this.postRequest(`/stores/${outletRefId}/status/`, {
      action: isOpen ? 'enable' : 'disable',
      reason: reason || (isOpen ? 'Store open for orders' : 'Store temporarily closed'),
    });
  }
}
