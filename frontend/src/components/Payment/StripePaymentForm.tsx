import React, { useState, useEffect } from 'react';
import { CardElement, useStripe, useElements, PaymentRequestButtonElement } from '@stripe/react-stripe-js';
import { useTranslation } from 'react-i18next';
import type { PaymentRequest } from '@stripe/stripe-js';

interface StripePaymentFormProps {
  clientSecret: string;
  amount: number;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
  isConfirming?: boolean;
}

const StripePaymentForm: React.FC<StripePaymentFormProps> = ({
  clientSecret,
  amount,
  onSuccess,
  onError,
  isConfirming = false,
}) => {
  const { t } = useTranslation(['payment']);
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);

  // Set up Payment Request (Apple Pay, Google Pay, etc.)
  useEffect(() => {
    if (!stripe) {
      return;
    }

    const pr = stripe.paymentRequest({
      country: 'FR', // France
      currency: 'eur',
      total: {
        label: 'Ferry Booking',
        amount: Math.round(amount * 100), // Convert to cents
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    // Check if Payment Request is available (Apple Pay, Google Pay, etc.)
    pr.canMakePayment().then((result) => {
      if (result) {
        setPaymentRequest(pr);
      }
    });

    // Handle payment method from Payment Request
    pr.on('paymentmethod', async (ev) => {
      setIsProcessing(true);
      try {
        // Confirm the payment with the payment method from Apple Pay/Google Pay
        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false }
        );

        if (confirmError) {
          ev.complete('fail');
          onError(confirmError.message || 'Payment failed');
        } else {
          ev.complete('success');
          if (paymentIntent.status === 'requires_action') {
            // Let Stripe handle any authentication
            const { error: authError } = await stripe.confirmCardPayment(clientSecret);
            if (authError) {
              onError(authError.message || 'Authentication failed');
            } else {
              onSuccess(paymentIntent.id);
            }
          } else if (paymentIntent.status === 'succeeded') {
            onSuccess(paymentIntent.id);
          }
        }
      } catch (err: any) {
        ev.complete('fail');
        onError(err.message || 'Payment processing failed');
      } finally {
        setIsProcessing(false);
      }
    });
  }, [stripe, amount, clientSecret, onSuccess, onError]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (error) {
        onError(error.message || 'Payment failed');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess(paymentIntent.id);
      }
    } catch (err: any) {
      onError(err.message || 'Payment processing failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
      },
      invalid: {
        color: '#9e2146',
      },
    },
    hidePostalCode: false,
  };

  return (
    <>
      {/* Confirmation Overlay */}
      {isConfirming && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 max-w-md mx-4">
            <div className="text-center">
              <svg className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirming Your Booking</h3>
              <p className="text-gray-600">Please wait while we finalize your reservation...</p>
              <p className="text-sm text-gray-500 mt-4">Do not close this window</p>
            </div>
          </div>
        </div>
      )}

      {/* Apple Pay / Google Pay Button */}
      {paymentRequest && (
        <div className="mb-4">
          <PaymentRequestButtonElement options={{ paymentRequest }} />
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or pay with card</span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <CardElement options={cardElementOptions} />
        </div>

        <button
          type="submit"
          disabled={!stripe || isProcessing || isConfirming}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
        >
          {isProcessing ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing Payment...
            </>
          ) : (
            `Pay €${amount.toFixed(2)}`
          )}
        </button>

        <div className="flex items-center justify-center text-sm text-gray-500">
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          {t('payment:timer.secureInfo')}
        </div>
      </form>
    </>
  );
};

export default StripePaymentForm;
