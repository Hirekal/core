/**
 * @fileoverview Custom checkout payment form styled like Stripe Checkout.
 */
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import type { StripeCardElementOptions } from '@stripe/stripe-js';
import Button from '../common/Button';
import BillingErrorState from './BillingErrorState';
import { formatMoney, isBillableSubscription } from '../../utils/billingFormat';
import { useToast } from '../../context/ToastContext';
import { persistSubscriptionSession } from '../../utils/billingStorage';
import * as billingService from '../../services/billingService';
import { toUserErrorMessage } from '../../utils/errorMessage';
import type { Price } from '../../types/billing';

const checkoutFieldClass =
  'w-full border-0 bg-transparent px-3 py-3 text-base text-heading placeholder:text-[#8898aa] focus:outline-none';
const checkoutBoxClass =
  'overflow-hidden rounded-md border border-[#e6ebf1] bg-white shadow-sm';

const BILLING_COUNTRIES = [
  { code: 'US', label: 'United States' },
  { code: 'IN', label: 'India' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
];

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
  clientSecret?: string;
  providerSubscriptionId?: string;
  payAmount?: number;
  successMessage?: string;
  navigationState?: Record<string, unknown>;
  prepareCheckout?: () => Promise<{
    clientSecret: string;
    providerSubscriptionId: string;
  }>;
  onCheckoutFailed?: () => Promise<void>;
  switchError?: string;
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
  prepareCheckout,
  onCheckoutFailed,
  switchError = '',
  onEmailChange,
  onNameChange,
}: CheckoutPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { showSuccess } = useToast();

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [billingName, setBillingName] = useState(name);
  const [billingCountry, setBillingCountry] = useState('US');
  const [billingAddress, setBillingAddress] = useState('');
  const [showManualAddress, setShowManualAddress] = useState(false);
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingPostal, setBillingPostal] = useState('');

  useEffect(() => {
    setBillingName(name);
  }, [name]);

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
    let checkoutPrepared = false;

    try {
      let resolvedClientSecret = clientSecret;
      let resolvedProviderSubscriptionId = providerSubscriptionId;

      if (prepareCheckout) {
        const checkoutSession = await prepareCheckout();
        resolvedClientSecret = checkoutSession.clientSecret;
        resolvedProviderSubscriptionId = checkoutSession.providerSubscriptionId;
        checkoutPrepared = true;
      }

      if (!resolvedClientSecret || !resolvedProviderSubscriptionId) {
        throw new Error('Checkout is missing required Stripe configuration');
      }

      const confirmation = await stripe.confirmCardPayment(resolvedClientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: {
            email: email.trim(),
            name: billingName.trim() || name.trim() || undefined,
            address: {
              line1: billingAddress.trim() || undefined,
              city: billingCity.trim() || undefined,
              state: billingState.trim() || undefined,
              postal_code: billingPostal.trim() || undefined,
              country: billingCountry,
            },
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
        resolvedProviderSubscriptionId,
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
      if (checkoutPrepared && onCheckoutFailed) {
        try {
          await onCheckoutFailed();
        } catch {
          // Ignore cleanup failures; surface the original payment error.
        }
      }
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
          <div className={`mt-3 ${checkoutBoxClass}`}>
            <input
              type="email"
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
              placeholder="Email"
              required
              className={checkoutFieldClass}
            />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-medium text-heading">Billing address</h2>
          <div className={`mt-3 ${checkoutBoxClass}`}>
            <input
              type="text"
              value={billingName}
              onChange={(event) => {
                setBillingName(event.target.value);
                onNameChange(event.target.value);
              }}
              placeholder="Name"
              required
              className={`${checkoutFieldClass} border-b border-[#e6ebf1]`}
            />
            <div className="relative border-b border-[#e6ebf1]">
              <select
                value={billingCountry}
                onChange={(event) => setBillingCountry(event.target.value)}
                className={`${checkoutFieldClass} appearance-none pr-10`}
              >
                {BILLING_COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-heading"
              />
            </div>
            <input
              type="text"
              value={billingAddress}
              onChange={(event) => setBillingAddress(event.target.value)}
              placeholder="Address"
              className={checkoutFieldClass}
            />
            {showManualAddress && (
              <>
                <input
                  type="text"
                  value={billingCity}
                  onChange={(event) => setBillingCity(event.target.value)}
                  placeholder="City"
                  className={`${checkoutFieldClass} border-t border-[#e6ebf1]`}
                />
                <div className="grid grid-cols-2 border-t border-[#e6ebf1]">
                  <input
                    type="text"
                    value={billingState}
                    onChange={(event) => setBillingState(event.target.value)}
                    placeholder="State"
                    className={`${checkoutFieldClass} border-r border-[#e6ebf1]`}
                  />
                  <input
                    type="text"
                    value={billingPostal}
                    onChange={(event) => setBillingPostal(event.target.value)}
                    placeholder="ZIP"
                    className={checkoutFieldClass}
                  />
                </div>
              </>
            )}
          </div>
          {!showManualAddress && (
            <button
              type="button"
              onClick={() => setShowManualAddress(true)}
              className="mt-2 text-sm text-muted underline underline-offset-2 hover:text-heading"
            >
              Enter address manually
            </button>
          )}
        </div>

        <div>
          <h2 className="text-sm font-medium text-heading">Payment details</h2>
          <p className="mt-1 text-sm text-muted">Card information</p>

          <div className={`mt-3 ${checkoutBoxClass}`}>
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
      </div>

      {(error || switchError) && (
        <div className="mt-4">
          <BillingErrorState message={error || switchError} />
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
