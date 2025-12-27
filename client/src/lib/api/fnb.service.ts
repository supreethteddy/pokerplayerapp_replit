/**
 * Food & Beverage API Service
 * Handles F&B menu and orders for players
 */

import { BaseAPIService } from './base';
import { API_ENDPOINTS } from './config';

/**
 * Menu item category
 */
export enum MenuCategory {
  FOOD = 'food',
  BEVERAGE = 'beverage',
  SNACKS = 'snacks',
  ALCOHOL = 'alcohol',
  DESSERT = 'dessert',
}

/**
 * Menu item
 */
export interface MenuItem {
  id: string;
  clubId: string;
  name: string;
  description?: string;
  category: MenuCategory;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  preparationTime?: number; // in minutes
  tags?: string[];
  allergens?: string[];
  calories?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Order status
 */
export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY = 'ready',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

/**
 * Order item
 */
export interface OrderItem {
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  price: number;
  subtotal: number;
  specialInstructions?: string;
}

/**
 * F&B Order
 */
export interface FNBOrder {
  id: string;
  clubId: string;
  playerId: string;
  tableId?: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  specialInstructions?: string;
  orderNumber?: string;
  estimatedDeliveryTime?: string;
  orderedAt: string;
  confirmedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
}

/**
 * Create order request
 */
export interface CreateFNBOrderDto {
  tableId?: string;
  items: {
    menuItemId: string;
    quantity: number;
    specialInstructions?: string;
  }[];
  specialInstructions?: string;
}

/**
 * Update order request
 */
export interface UpdateFNBOrderDto {
  status?: OrderStatus;
  specialInstructions?: string;
}

/**
 * Menu response
 */
export interface MenuResponse {
  items: MenuItem[];
  total: number;
  categories: MenuCategory[];
}

/**
 * Orders response
 */
export interface OrdersResponse {
  orders: FNBOrder[];
  total: number;
}

/**
 * Food & Beverage Service
 */
export class FNBService extends BaseAPIService {
  /**
   * Get F&B menu for the club
   */
  async getMenu(): Promise<MenuResponse> {
    const { clubId } = this.getPlayerSession();
    if (!clubId) {
      throw new Error('Club ID not found');
    }
    
    return this.get<MenuResponse>(API_ENDPOINTS.clubs.getFNBMenu(clubId));
  }

  /**
   * Get menu items by category
   */
  async getMenuByCategory(category: MenuCategory): Promise<MenuItem[]> {
    const menu = await this.getMenu();
    return menu.items.filter((item) => item.category === category);
  }

  /**
   * Get available menu items only
   */
  async getAvailableMenuItems(): Promise<MenuItem[]> {
    const menu = await this.getMenu();
    return menu.items.filter((item) => item.isAvailable);
  }

  /**
   * Search menu items
   */
  async searchMenuItems(searchTerm: string): Promise<MenuItem[]> {
    const menu = await this.getMenu();
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    return menu.items.filter(
      (item) =>
        item.name.toLowerCase().includes(lowerSearchTerm) ||
        item.description?.toLowerCase().includes(lowerSearchTerm) ||
        item.tags?.some((tag) => tag.toLowerCase().includes(lowerSearchTerm))
    );
  }

  /**
   * Create F&B order
   */
  async createOrder(orderData: CreateFNBOrderDto): Promise<{
    success: boolean;
    message: string;
    order: FNBOrder;
  }> {
    const { clubId } = this.getPlayerSession();
    if (!clubId) {
      throw new Error('Club ID not found');
    }
    
    return this.post<{
      success: boolean;
      message: string;
      order: FNBOrder;
    }>(API_ENDPOINTS.clubs.createFNBOrder(clubId), orderData);
  }

  /**
   * Get player's F&B orders
   */
  async getOrders(): Promise<OrdersResponse> {
    const { clubId } = this.getPlayerSession();
    if (!clubId) {
      throw new Error('Club ID not found');
    }
    
    return this.get<OrdersResponse>(API_ENDPOINTS.clubs.getFNBOrders(clubId));
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<FNBOrder | null> {
    const orders = await this.getOrders();
    return orders.orders.find((order) => order.id === orderId) || null;
  }

  /**
   * Get active orders (pending, confirmed, preparing, ready)
   */
  async getActiveOrders(): Promise<FNBOrder[]> {
    const orders = await this.getOrders();
    return orders.orders.filter(
      (order) =>
        order.status === OrderStatus.PENDING ||
        order.status === OrderStatus.CONFIRMED ||
        order.status === OrderStatus.PREPARING ||
        order.status === OrderStatus.READY
    );
  }

  /**
   * Get order history
   */
  async getOrderHistory(): Promise<FNBOrder[]> {
    const orders = await this.getOrders();
    return orders.orders.filter(
      (order) =>
        order.status === OrderStatus.DELIVERED ||
        order.status === OrderStatus.CANCELLED
    );
  }

  /**
   * Update order (mainly for cancellation)
   */
  async updateOrder(
    orderId: string,
    updateData: UpdateFNBOrderDto
  ): Promise<{
    success: boolean;
    message: string;
    order: FNBOrder;
  }> {
    const { clubId } = this.getPlayerSession();
    if (!clubId) {
      throw new Error('Club ID not found');
    }
    
    return this.put<{
      success: boolean;
      message: string;
      order: FNBOrder;
    }>(API_ENDPOINTS.clubs.updateFNBOrder(clubId, orderId), updateData);
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string): Promise<{
    success: boolean;
    message: string;
    order: FNBOrder;
  }> {
    return this.updateOrder(orderId, { status: OrderStatus.CANCELLED });
  }

  /**
   * Calculate order total
   */
  calculateOrderTotal(items: CreateFNBOrderDto['items'], menuItems: MenuItem[]): number {
    return items.reduce((total, item) => {
      const menuItem = menuItems.find((mi) => mi.id === item.menuItemId);
      if (menuItem) {
        return total + menuItem.price * item.quantity;
      }
      return total;
    }, 0);
  }

  /**
   * Get total spent on F&B
   */
  async getTotalSpent(): Promise<number> {
    const orders = await this.getOrders();
    return orders.orders
      .filter((order) => order.status === OrderStatus.DELIVERED)
      .reduce((total, order) => total + order.totalAmount, 0);
  }
}

// Export singleton instance
export const fnbService = new FNBService();









