// @ts-nocheck
import { logFirebaseEvent } from '../utils/firebaseAnalytics';

export const AnalyticsService = {
  logProductView: async (product: any) => {
    // Standard GA4 event for viewing a product
    await logFirebaseEvent('view_item', {
      currency: 'UAH',
      value: product.price,
      items: [{
        item_id: String(product.id),
        item_name: product.name,
        price: product.price,
        item_category: product.category,
        quantity: 1
      }]
    });
  },

  logAddToCart: async (product: any, quantity: number = 1) => {
    // Standard GA4 event for adding to cart
    await logFirebaseEvent('add_to_cart', {
      currency: 'UAH',
      value: (product.price || 0) * quantity,
      items: [{
        item_id: String(product.id),
        item_name: product.name,
        price: product.price,
        item_category: product.category,
        quantity: quantity
      }]
    });
  },

  logSearch: async (term: string) => {
    // Standard GA4 event for search
    await logFirebaseEvent('search', {
      search_term: term
    });
  },

  logCategorySelect: async (category: string) => {
    // Using select_content for category selection or view_item_list
    await logFirebaseEvent('select_content', {
      content_type: 'category',
      item_id: category
    });
  }
};