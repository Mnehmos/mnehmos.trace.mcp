/**
 * Order interface for testing import resolution.
 * This file imports User from ./user.ts
 */

import { User, UserSummary } from './user';

/**
 * Status of an order
 */
export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

/**
 * Individual item in an order
 */
export interface OrderItem {
  /** Product identifier */
  productId: string;
  
  /** Product name */
  name: string;
  
  /** Quantity ordered */
  quantity: number;
  
  /** Price per unit */
  unitPrice: number;
}

/**
 * Represents an order in the system
 */
export interface Order {
  /** Unique order identifier */
  id: string;
  
  /** User who placed the order (cross-file reference) */
  user: User;
  
  /** Items in this order */
  items: OrderItem[];
  
  /** Current order status */
  status: OrderStatus;
  
  /** Total order amount */
  total: number;
  
  /** Order creation timestamp */
  createdAt: Date;
}

/**
 * Summary of an order with minimal user info
 */
export interface OrderSummary {
  /** Order ID */
  id: string;
  
  /** User summary (uses Pick from user.ts) */
  user: UserSummary;
  
  /** Item count */
  itemCount: number;
  
  /** Total amount */
  total: number;
}

/**
 * Order with related data
 */
export type OrderWithDetails = Order & {
  /** Shipping address */
  shippingAddress: string;
  
  /** Billing address */
  billingAddress: string;
};
