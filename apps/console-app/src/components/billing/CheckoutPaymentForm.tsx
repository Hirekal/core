/**
 * @fileoverview Custom checkout payment form styled like Stripe Checkout.
 */
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import type {
  StripeCardCvcElementChangeEvent,
  StripeCardElementOptions,
  StripeCardExpiryElementChangeEvent,
  StripeCardNumberElementChangeEvent,
} from '@stripe/stripe-js';
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
  { code: '', label: 'Country or region' },
  { code: 'US', label: 'United States' },
  { code: 'IN', label: 'India' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  onCheckoutSucceeded?: () => void;
  switchError?: string;
  disabled?: boolean;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
}

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
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
  onCheckoutSucceeded,
  switchError = '',
  disabled = false,
  onEmailChange,
  onNameChange,
}: CheckoutPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { showSuccess } = useToast();

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [billingName, setBillingName] = useState(name ?? '');
  const [billingCountry, setBillingCountry] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [showManualAddress, setShowManualAddress] = useState(false);
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingPostal, setBillingPostal] = useState('');
  const [touched, setTouched] = useState({
    email: false,
    name: false,
    country: false,
    address: false,
    city: false,
    postal: false,
  });

  const [cardNumberComplete, setCardNumberComplete] = useState(false);
  const [cardExpiryComplete, setCardExpiryComplete] = useState(false);
  const [cardCvcComplete, setCardCvcComplete] = useState(false);
  const [cardNumberError, setCardNumberError] = useState<string | null>(null);
  const [cardExpiryError, setCardExpiryError] = useState<string | null>(null);
  const [cardCvcError, setCardCvcError] = useState<string | null>(null);

  useEffect(() => {
    setBillingName(name ?? '');
  }, [name]);

  const formLocked = disabled || processing;
  const cardOptions: StripeCardElementOptions = {
    ...cardElementOptions,
    disabled: formLocked,
  };

  const trimmedEmail = email.trim();
  const trimmedName = billingName.trim();
  const trimmedAddress = billingAddress.trim();
  const trimmedCity = billingCity.trim();
  const trimmedPostal = billingPostal.trim();

  const emailValid = isValidEmail(trimmedEmail);
  const nameValid = trimmedName.length > 0;
  const countryValid = billingCountry.length > 0;
  const addressValid = trimmedAddress.length > 0;
  const cityValid = !showManualAddress || trimmedCity.length > 0;
  const postalValid = !showManualAddress || trimmedPostal.length > 0;

  const billingValid =
    emailValid &&
    nameValid &&
    countryValid &&
    addressValid &&
    cityValid &&
    postalValid;

  const stripePaymentValid =
    cardNumberComplete &&
    cardExpiryComplete &&
    cardCvcComplete &&
    !cardNumberError &&
    !cardExpiryError &&
    !cardCvcError;

  const canPay = Boolean(
    stripe &&
      elements &&
      !formLocked &&
      !switchError &&
      billingValid &&
      stripePaymentValid,
  );

  const emailError =
    touched.email && !emailValid
      ? trimmedEmail
        ? 'Enter a valid email address'
        : 'Email is required'
      : '';
  const nameError =
    touched.name && !nameValid ? 'Name is required' : '';
  const countryError =
    touched.country && !countryValid ? 'Country or region is required' : '';
  const addressError =
    touched.address && !addressValid ? 'Address is required' : '';
  const cityError =
    showManualAddress && touched.city && !cityValid ? 'City is required' : '';
  const postalError =
    showManualAddress && touched.postal && !postalValid
      ? 'ZIP / postal code is required'
      : '';

  const stripeFieldError = useMemo(
    () => cardNumberError || cardExpiryError || cardCvcError || '',
    [cardNumberError, cardExpiryError, cardCvcError],
  );

  const markBillingTouched = () => {
    setTouched({
      email: true,
      name: true,
      country: true,
      address: true,
      city: true,
      postal: true,
    });
  };

  const handleCardNumberChange = (event: StripeCardNumberElementChangeEvent) => {
    setCardNumberComplete(event.complete);
    setCardNumberError(event.error?.message ?? null);
  };

  const handleCardExpiryChange = (event: StripeCardExpiryElementChangeEvent) => {
    setCardExpiryComplete(event.complete);
    setCardExpiryError(event.error?.message ?? null);
  };

  const handleCardCvcChange = (event: StripeCardCvcElementChangeEvent) => {
    setCardCvcComplete(event.complete);
    setCardCvcError(event.error?.message ?? null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    markBillingTouched();

    if (disabled || processing || !stripe || !elements) {
      return;
    }

    if (!billingValid || !stripePaymentValid) {
      setError(
        !billingValid
          ? 'Please complete all required billing information.'
          : 'Please complete your card details.',
      );
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

      const trimmedState = billingState.trim();

      const confirmation = await stripe.confirmCardPayment(resolvedClientSecret, {
        payment_method: {
          card: cardNumberElement,
          billing_details: {
            email: trimmedEmail,
            name: trimmedName,
            address: {
              line1: trimmedAddress,
              ...(trimmedCity ? { city: trimmedCity } : {}),
              ...(trimmedState ? { state: trimmedState } : {}),
              ...(trimmedPostal ? { postal_code: trimmedPostal } : {}),
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

      onCheckoutSucceeded?.();

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
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex h-full min-h-screen flex-col bg-white px-6 py-12 sm:px-8 sm:py-14 lg:px-10 lg:py-16 xl:px-12"
      aria-busy={disabled || processing}
    >
      <div className="mx-auto w-full max-w-xl lg:ml-0 lg:mr-auto lg:max-w-2xl">
        <section>
          <h2 className="text-base font-semibold text-heading">Billing information</h2>

          <div className="mt-5">
            <label htmlFor="checkout-email" className="block text-sm text-muted">
              Email
            </label>
            <div
              className={`mt-2 ${checkoutBoxClass} ${
                emailError ? 'border-[#df1b41]' : ''
              }`}
            >
              <input
                id="checkout-email"
                type="email"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                onBlur={() => setTouched((current) => ({ ...current, email: true }))}
                placeholder="Email"
                disabled={formLocked}
                autoComplete="email"
                className={`${checkoutFieldClass} disabled:cursor-not-allowed disabled:opacity-100`}
              />
            </div>
            {emailError ? (
              <p className="mt-1.5 text-sm text-[#df1b41]">{emailError}</p>
            ) : null}
          </div>

          <div className="mt-5">
            <p className="text-sm text-muted">Billing address</p>
            <div
              className={`mt-2 ${checkoutBoxClass} ${
                nameError || countryError || addressError || cityError || postalError
                  ? 'border-[#df1b41]'
                  : ''
              }`}
            >
              <input
                type="text"
                value={billingName}
                onChange={(event) => {
                  setBillingName(event.target.value);
                  onNameChange(event.target.value);
                }}
                onBlur={() => setTouched((current) => ({ ...current, name: true }))}
                placeholder="Name"
                autoComplete="name"
                disabled={formLocked}
                className={`${checkoutFieldClass} border-b border-[#e6ebf1] disabled:cursor-not-allowed disabled:opacity-100`}
              />
              <div className="relative border-b border-[#e6ebf1]">
                <select
                  value={billingCountry}
                  onChange={(event) => setBillingCountry(event.target.value)}
                  onBlur={() =>
                    setTouched((current) => ({ ...current, country: true }))
                  }
                  disabled={formLocked}
                  aria-label="Country or region"
                  className={`${checkoutFieldClass} appearance-none pr-10 disabled:cursor-not-allowed disabled:opacity-100 ${
                    billingCountry ? 'text-heading' : 'text-[#8898aa]'
                  }`}
                >
                  {BILLING_COUNTRIES.map((country) => (
                    <option key={country.code || 'blank'} value={country.code}>
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
                onBlur={() =>
                  setTouched((current) => ({ ...current, address: true }))
                }
                placeholder="Address"
                autoComplete="street-address"
                disabled={formLocked}
                className={`${checkoutFieldClass} disabled:cursor-not-allowed disabled:opacity-100`}
              />
              {showManualAddress && (
                <>
                  <input
                    type="text"
                    value={billingCity}
                    onChange={(event) => setBillingCity(event.target.value)}
                    onBlur={() =>
                      setTouched((current) => ({ ...current, city: true }))
                    }
                    placeholder="City"
                    autoComplete="address-level2"
                    disabled={formLocked}
                    className={`${checkoutFieldClass} border-t border-[#e6ebf1] disabled:cursor-not-allowed disabled:opacity-100`}
                  />
                  <div className="grid grid-cols-2 border-t border-[#e6ebf1]">
                    <input
                      type="text"
                      value={billingState}
                      onChange={(event) => setBillingState(event.target.value)}
                      placeholder="State"
                      autoComplete="address-level1"
                      disabled={formLocked}
                      className={`${checkoutFieldClass} border-r border-[#e6ebf1] disabled:cursor-not-allowed disabled:opacity-100`}
                    />
                    <input
                      type="text"
                      value={billingPostal}
                      onChange={(event) => setBillingPostal(event.target.value)}
                      onBlur={() =>
                        setTouched((current) => ({ ...current, postal: true }))
                      }
                      placeholder="ZIP"
                      autoComplete="postal-code"
                      disabled={formLocked}
                      className={`${checkoutFieldClass} disabled:cursor-not-allowed disabled:opacity-100`}
                    />
                  </div>
                </>
              )}
            </div>
            {(nameError || countryError || addressError || cityError || postalError) && (
              <p className="mt-1.5 text-sm text-[#df1b41]">
                {nameError ||
                  countryError ||
                  addressError ||
                  cityError ||
                  postalError}
              </p>
            )}
            {!showManualAddress && (
              <button
                type="button"
                onClick={() => setShowManualAddress(true)}
                disabled={formLocked}
                className="mt-2 text-sm text-muted underline underline-offset-2 hover:text-heading disabled:cursor-not-allowed disabled:opacity-100 disabled:no-underline"
              >
                Enter address manually
              </button>
            )}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-base font-semibold text-heading">Payment details</h2>
          <p className="mt-5 text-sm text-muted">Card information</p>
          <div
            className={`mt-2 ${checkoutBoxClass} ${
              stripeFieldError ? 'border-[#df1b41]' : ''
            }`}
          >
            <div className="border-b border-[#e6ebf1] px-3 py-3">
              <CardNumberElement
                options={cardOptions}
                onChange={handleCardNumberChange}
              />
            </div>
            <div className="grid grid-cols-2">
              <div className="border-r border-[#e6ebf1] px-3 py-3">
                <CardExpiryElement
                  options={cardOptions}
                  onChange={handleCardExpiryChange}
                />
              </div>
              <div className="px-3 py-3">
                <CardCvcElement
                  options={cardOptions}
                  onChange={handleCardCvcChange}
                />
              </div>
            </div>
          </div>
          {stripeFieldError ? (
            <p className="mt-1.5 text-sm text-[#df1b41]">{stripeFieldError}</p>
          ) : null}
        </section>

        {(error || switchError) && (
          <div className="mt-5">
            <BillingErrorState message={error || switchError} />
          </div>
        )}

        <div className="mt-8">
          <Button
            type="submit"
            className="w-full !rounded-md !bg-[#1a1f36] !py-3.5 text-base font-medium hover:!bg-[#111527] disabled:!opacity-50 disabled:!cursor-not-allowed"
            disabled={!canPay}
          >
            {processing
              ? 'Processing…'
              : disabled
                ? 'Updating checkout…'
                : `Pay ${formatMoney(payAmount ?? price.amount, price.currency)}`}
          </Button>
        </div>
      </div>
    </form>
  );
}
