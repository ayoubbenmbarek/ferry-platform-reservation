import api, { getErrorMessage } from './api';

export interface PaymentMethod {
  id: number;
  method_type: string;
  is_default: boolean;
  is_active: boolean;
  card_last_four: string | null;
  card_brand: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  billing_name: string | null;
  billing_country: string | null;
  created_at: string;
}

export interface BillingAddress {
  name: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
}

export interface AddPaymentMethodData {
  method_type: 'credit_card' | 'debit_card';
  billing_address: BillingAddress;
  is_default?: boolean;
  stripe_payment_method_id?: string;
}

export const paymentMethodService = {
  // Get all saved payment methods
  async getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      const response = await api.get<PaymentMethod[]>('/payments/saved-methods');
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Add a new payment method
  async addPaymentMethod(data: AddPaymentMethodData): Promise<PaymentMethod> {
    try {
      const response = await api.post<PaymentMethod>('/payments/saved-methods', data);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Delete a payment method
  async deletePaymentMethod(methodId: number): Promise<void> {
    try {
      await api.delete(`/payments/saved-methods/${methodId}`);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Set a payment method as default
  async setDefaultPaymentMethod(methodId: number): Promise<PaymentMethod> {
    try {
      const response = await api.post<PaymentMethod>(`/payments/saved-methods/${methodId}/set-default`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  },

  // Get card brand icon name
  getCardBrandIcon(brand: string | null): string {
    switch (brand?.toLowerCase()) {
      case 'visa':
        return 'card';
      case 'mastercard':
        return 'card';
      case 'amex':
      case 'american express':
        return 'card';
      case 'discover':
        return 'card';
      default:
        return 'card-outline';
    }
  },

  // Format card display name
  formatCardDisplayName(method: PaymentMethod): string {
    const brand = method.card_brand || 'Card';
    const last4 = method.card_last_four || '****';
    return `${brand.charAt(0).toUpperCase() + brand.slice(1)} •••• ${last4}`;
  },

  // Check if card is expired
  isCardExpired(method: PaymentMethod): boolean {
    if (!method.card_exp_month || !method.card_exp_year) {
      return false;
    }
    const now = new Date();
    const expDate = new Date(method.card_exp_year, method.card_exp_month - 1);
    return expDate < now;
  },

  // Format expiry date
  formatExpiryDate(method: PaymentMethod): string {
    if (!method.card_exp_month || !method.card_exp_year) {
      return '';
    }
    const month = method.card_exp_month.toString().padStart(2, '0');
    const year = method.card_exp_year.toString().slice(-2);
    return `${month}/${year}`;
  },
};
