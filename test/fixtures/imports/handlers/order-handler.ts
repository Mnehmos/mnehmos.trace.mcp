/**
 * Order handler for testing import resolution.
 * Imports Order which in turn imports User - multi-level resolution.
 */

import { Order, OrderSummary, OrderStatus, OrderItem } from '../types';
import type { User } from '../types/user';

/**
 * Input for creating a new order
 */
export interface CreateOrderInput {
  userId: string;
  items: OrderItem[];
  shippingAddress?: string;
}

/**
 * Input for updating order status
 */
export interface UpdateOrderStatusInput {
  orderId: string;
  status: OrderStatus;
}

/**
 * Response wrapper for order operations
 */
export interface OrderResponse<T = Order> {
  data: T;
  success: boolean;
  message?: string;
}

/**
 * Query filters for listing orders
 */
export interface OrderListFilters {
  userId?: string;
  status?: OrderStatus;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Order handler with CRUD operations
 */
export interface OrderHandler {
  /**
   * Create a new order
   */
  create(input: CreateOrderInput): Promise<OrderResponse>;
  
  /**
   * Get an order by ID
   */
  get(orderId: string): Promise<OrderResponse>;
  
  /**
   * Get order summary
   */
  getSummary(orderId: string): Promise<OrderResponse<OrderSummary>>;
  
  /**
   * Update order status
   */
  updateStatus(input: UpdateOrderStatusInput): Promise<OrderResponse>;
  
  /**
   * Cancel an order
   */
  cancel(orderId: string, reason?: string): Promise<OrderResponse>;
  
  /**
   * List orders with optional filters
   */
  list(filters?: OrderListFilters): Promise<OrderResponse<Order[]>>;
  
  /**
   * Get orders for a specific user
   */
  getByUser(user: User): Promise<OrderResponse<Order[]>>;
}
