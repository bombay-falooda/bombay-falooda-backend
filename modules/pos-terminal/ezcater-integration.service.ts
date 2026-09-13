import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EzcaterOrderDetails {
  uuid: string;
  ordernumber?: string;
  ordersourcetype?: string;
  lifecycle?: {
    orderiscurrently: string;
  };
  caterer?: {
    uuid: string;
    name: string;
    storenumber: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
  };
  ordercustomer?: {
    fullname?: string;
    firstname?: string;
    lastname?: string;
  };
  event?: {
    catererhandofffoodtime?: string;
    timestamp?: string;
    headcount?: number;
    ordertype?: string;
    customerprovidedname?: string;
    contact?: {
      name?: string;
      phone?: string;
    };
    address?: {
      street?: string;
      street2?: string;
      city?: string;
      state?: string;
      zip?: string;
      deliveryinstructions?: string;
    };
  };
  caterercart?: {
    orderitems?: Array<{
      uuid: string;
      name: string;
      positemid?: string;
      quantity: number;
      specialinstructions?: string;
      notetocaterer?: string;
      menuitemsizename?: string;
      totalinsubunits?: {
        currency: string;
        subunits: number;
      };
      customizations?: Array<{
        name: string;
        poscustomizationid?: string;
        quantity: number;
        customizationtypename?: string;
      }>;
    }>;
    tableware?: {
      specialinstructions?: string;
      tablewarechoices?: Array<{
        choiceuuid?: string;
        name?: string;
        itemcount?: number;
        isincluded?: boolean;
      }>;
    };
    totals?: {
      caterertotaldue?: number;
    };
  };
  totals?: {
    subtotal?: { subunits: number };
    salestax?: { subunits: number };
    tip?: { subunits: number };
    customertotaldue?: { subunits: number };
  };
}

@Injectable()
export class EzcaterIntegrationService {
  private readonly logger = new Logger(EzcaterIntegrationService.name);
  private readonly graphqlEndpoint: string;
  private readonly apiToken: string;

  constructor(private readonly configService: ConfigService) {
    this.graphqlEndpoint =
      this.configService.get<string>('EZCATER_API_URL') ||
      'https://api.ezcater.com/graphql';
    this.apiToken = this.configService.get<string>('EZCATER_API_TOKEN') || '';
  }

  /**
   * Helper to execute GraphQL queries & mutations on ezCater API
   * Specification: https://api.ezcater.io/using-graphql
   */
  private async executeGraphQL<T = any>(
    query: string,
    variables: Record<string, any> = {},
    operationName?: string,
  ): Promise<{ success: boolean; data?: T; errors?: any[] }> {
    this.logger.log(`[ezCater GraphQL] Operation: ${operationName || 'Anonymous'} Variables: ${JSON.stringify(variables)}`);

    if (!this.apiToken) {
      this.logger.warn(`[ezCater GraphQL] EZCATER_API_TOKEN not set. Returning mock success.`);
      return {
        success: true,
        data: { mock: true, message: 'Mock ezCater response (API token not configured)' } as any,
      };
    }

    try {
      const response = await fetch(this.graphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.apiToken.startsWith('Bearer ') ? this.apiToken : `Bearer ${this.apiToken}`,
          'apollographql-client-name': 'BombayFalooda-POS',
          'apollographql-client-version': '1.0.0',
        },
        body: JSON.stringify({
          query,
          variables,
          operationName,
        }),
      });

      const json = await response.json();

      if (json.errors && json.errors.length > 0) {
        this.logger.error(`[ezCater GraphQL Errors]: ${JSON.stringify(json.errors)}`);
        return { success: false, errors: json.errors, data: json.data };
      }

      return { success: true, data: json.data };
    } catch (err: any) {
      this.logger.error(`[ezCater GraphQL Network Error]: ${err?.message || err}`);
      return { success: false, errors: [{ message: err?.message || 'Network error' }] };
    }
  }

  /**
   * 1. Query Order Details by Order UUID
   * Documentation: https://api.ezcater.io/order-details
   */
  async getOrderDetails(orderUuid: string): Promise<{ success: boolean; order?: EzcaterOrderDetails; error?: string }> {
    const query = `
      query OrderQuery($orderid: ID!) {
        order(id: $orderid) {
          uuid
          ordernumber
          ordersourcetype
          lifecycle {
            orderiscurrently
          }
          caterer {
            uuid
            name
            storenumber
            address {
              street
              city
              state
              zip
            }
          }
          ordercustomer {
            fullname
            firstname
            lastname
          }
          event {
            catererhandofffoodtime
            timestamp
            headcount
            ordertype
            customerprovidedname
            contact {
              name
              phone
            }
            address {
              street
              street2
              city
              state
              zip
              deliveryinstructions
            }
          }
          caterercart {
            orderitems {
              uuid
              name
              positemid
              quantity
              specialinstructions
              notetocaterer
              menuitemsizename
              totalinsubunits {
                currency
                subunits
              }
              customizations {
                name
                poscustomizationid
                quantity
                customizationtypename
              }
            }
            tableware {
              specialinstructions
              tablewarechoices {
                choiceuuid
                name
                itemcount
                isincluded
              }
            }
            totals {
              caterertotaldue
            }
          }
          totals {
            subtotal {
              subunits
            }
            salestax {
              subunits
            }
            tip {
              subunits
            }
            customertotaldue {
              subunits
            }
          }
        }
      }
    `;

    const res = await this.executeGraphQL<{ order: EzcaterOrderDetails }>(
      query,
      { orderid: orderUuid },
      'OrderQuery',
    );

    if (!res.success || !res.data?.order) {
      return {
        success: false,
        error: res.errors?.[0]?.message || 'Failed to fetch ezCater order details',
      };
    }

    return { success: true, order: res.data.order };
  }

  /**
   * 2. Accept Order / Order Modification
   * Documentation: https://api.ezcater.io/order-accept
   */
  async acceptOrder(orderUuid: string, acceptModification = false) {
    const mutation = `
      mutation acceptOrder($orderid: ID!, $acceptModification: Boolean) {
        acceptOrder(orderId: $orderid, acceptModification: $acceptModification) {
          order {
            uuid
            lifecycle {
              orderiscurrently
            }
          }
        }
      }
    `;

    return this.executeGraphQL(
      mutation,
      {
        orderid: orderUuid,
        acceptModification,
      },
      'acceptOrder',
    );
  }

  /**
   * 3. Reject Order
   * Documentation: https://api.ezcater.io/order-reject
   */
  async rejectOrder(
    orderUuid: string,
    reason = 'at daily capacity',
    explanation = 'Kitchen at capacity / Items unavailable',
  ) {
    const mutation = `
      mutation rejectOrder($orderid: ID!, $rejectorderinput: RejectOrderInput!) {
        rejectOrder(orderId: $orderid, rejectOrderInput: $rejectorderinput) {
          order {
            uuid
            lifecycle {
              orderiscurrently
            }
          }
        }
      }
    `;

    return this.executeGraphQL(
      mutation,
      {
        orderid: orderUuid,
        rejectorderinput: {
          reason,
          explanation,
        },
      },
      'rejectOrder',
    );
  }

  /**
   * 4. Toggle Item Stock Status on ezCater (Menu 86 / Availability)
   * Documentation: https://api.ezcater.io/menus-api
   */
  async updateItemStock(catererId: string, itemId: string, inStock: boolean) {
    this.logger.log(`[ezCater Item Stock Toggle] Caterer ${catererId}, Item ${itemId}, inStock: ${inStock}`);

    const mutation = `
      mutation updateItemAvailability($catererId: ID!, $itemId: ID!, $isAvailable: Boolean!) {
        updateItemAvailability(catererId: $catererId, itemId: $itemId, isAvailable: $isAvailable) {
          success
          message
        }
      }
    `;

    return this.executeGraphQL(
      mutation,
      {
        catererId,
        itemId,
        isAvailable: inStock,
      },
      'updateItemAvailability',
    );
  }

  /**
   * 5. Register Webhook Subscription
   * Documentation: https://api.ezcater.io/subscription-create
   */
  async createOrderSubscription(catererId: string, subscriberId: string, eventKey: 'submitted' | 'accepted' | 'cancelled' | 'rejected' = 'accepted') {
    const mutation = `
      mutation subscriptionCreate($subscriptionparams: SubscriptionParamsInput!) {
        subscriptionCreate(subscriptionParams: $subscriptionparams) {
          subscription {
            id
            eventEntity
            eventKey
          }
        }
      }
    `;

    return this.executeGraphQL(
      mutation,
      {
        subscriptionparams: {
          eventEntity: 'order',
          eventKey,
          parentEntity: 'caterer',
          parentId: catererId,
          subscriberId,
        },
      },
      'subscriptionCreate',
    );
  }
}
