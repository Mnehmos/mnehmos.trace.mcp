/**
 * Models file accessed via path alias 'models'.
 * Tests tsconfig paths resolution: "models" → "aliased/models"
 */

/**
 * Product model
 */
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: ProductCategory;
  inStock: boolean;
}

/**
 * Product category
 */
export type ProductCategory = 'electronics' | 'clothing' | 'food' | 'books' | 'other';

/**
 * Inventory model
 */
export interface Inventory {
  productId: string;
  quantity: number;
  location: string;
  lastUpdated: Date;
}

/**
 * Combined product with inventory data
 */
export interface ProductWithInventory extends Product {
  inventory: Inventory[];
  totalStock: number;
}

/**
 * Shopping cart model
 */
export interface CartItem {
  product: Product;
  quantity: number;
  addedAt: Date;
}

/**
 * Full shopping cart
 */
export interface ShoppingCart {
  id: string;
  items: CartItem[];
  total: number;
  createdAt: Date;
  updatedAt: Date;
}
