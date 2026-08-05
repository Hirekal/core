/**
 * @fileoverview Custom checkout payment form styled like Stripe Checkout.
 */
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import type { StripeCardElementOptions } from '@stripe/stripe-js';
import Input from '../common/Input';
import Button from '../common/Button';
import BillingErrorState from './BillingErrorState';
import { formatMoney, isBillableSubscription } from '../../utils/billingFormat';
import { useToast } from '../../context/ToastContext';
import { persistSubscriptionSession } from '../../utils/billingStorage';
import * as billingService from '../../services/billingService';
import { toUserErrorMessage } from '../../utils/errorMessage';
import type { Price } from '../../types/billing';

const cardElementOptions: StripeCardElementOptions = {
  style: {
    base: {
      color: '#1a1f36',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      fontSize: '16px',
      fontSmoothing: 'antialiased',
      '::placeholder': {
        color: '#8898aa',
      },
    },
    invalid: {
      color: '#df1b41',
    },
  },
};

interface CheckoutPaymentFormProps {
  price: Price;
  email: string;
  name: string;
  clientSecret: string;
  providerSubscriptionId: string;
  payAmount?: number;
  successMessage?: string;
  navigationState?: Record<string, unknown>;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
}

/**
 * Collects billing details and confirms the subscription payment intent.
 */
export default function CheckoutPaymentForm({
  price,
  email,
  name,
  clientSecret,
  providerSubscriptionId,
  payAmount,
  successMessage = 'Subscription activated successfully',
  navigationState,
  onEmailChange,
  onNameChange,
}: CheckoutPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { showSuccess } = useToast();

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!stripe || !elements) {
      return;
    }

    const cardNumberElement = elements.getElement(CardNumberElement);
    if (!cardNumberElement) {
      setError('Card details are not ready yet.');
      return;
    }

    setProcessing(true);
    try {
      const confirmation = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: {
            email: email.trim(),
            name: name.trim() || undefined,
          },
        },
      });

      if (confirmation.error) {
        throw confirmation.error;
      }

      if (confirmation.paymentIntent?.status !== 'succeeded') {
        throw new Error('Payment could not be completed.');
      }

      const subscription = await billingService.syncCheckoutSubscription(
        providerSubscriptionId,
        confirmation.paymentIntent?.id,
      );

      if (!isBillableSubscription(subscription)) {
        throw new Error(
          'Payment succeeded but your subscription is still activating. Please wait a moment and refresh the plans page.',
        );
      }

      persistSubscriptionSession(
        subscription.id,
        subscription.paymentProviderId,
        subscription.customerId,
      );

      showSuccess(successMessage);

      navigate('/billing/plans', {
        replace: true,
        state: {
          subscription,
          subscribed: true,
          ...navigationState,
        },
      });
    } catch (err) {
      setError(toUserErrorMessage(err, 'Payment failed'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex h-full flex-col px-6 py-8 sm:px-10 lg:px-12">
      <div className="space-y-6">
        <div>
          <h2 className="text-sm font-medium text-heading">Contact information</h2>
          <div className="mt-3">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-heading">Payment details</h2>
          <p className="mt-1 text-sm text-muted">Card information</p>

          <div className="mt-3 overflow-hidden rounded-md border border-[#e6ebf1] bg-white shadow-sm">
            <div className="border-b border-[#e6ebf1] px-3 py-3">
              <CardNumberElement options={cardElementOptions} />
            </div>
            <div className="grid grid-cols-2">
              <div className="border-r border-[#e6ebf1] px-3 py-3">
                <CardExpiryElement options={cardElementOptions} />
              </div>
              <div className="px-3 py-3">
                <CardCvcElement options={cardElementOptions} />
              </div>
            </div>
          </div>
        </div>

        <div>
          <Input
            label="Name on card"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Full name on card"
          />
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <BillingErrorState message={error} />
        </div>
      )}

      <div className="mt-8">
        <Button
          type="submit"
          className="w-full !rounded-md !bg-[#1a1f36] !py-3.5 text-base font-medium hover:!bg-[#111527]"
          disabled={processing || !stripe || !elements}
        >
          {processing
            ? 'Processing…'
            : `Pay ${formatMoney(payAmount ?? price.amount, price.currency)}`}
        </Button>
      </div>
    </form>
  );
}
