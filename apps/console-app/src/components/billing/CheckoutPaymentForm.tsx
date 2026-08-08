/**
 * @fileoverview Checkout payment form with Stripe Checkout-style billing + Card Elements.
 *
 * Billing address is a custom condensed box (Name / Country / Address) so text stays
 * vertically centered. Stripe Address Element floating labels always reserve title
 * space and cannot match that UI reliably. Card fields stay on Stripe Elements;
 * billing details are passed into confirmCardPayment.
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
  'w-full border-0 bg-transparent px-3 py-3 text-base leading-5 text-[#1a1f36] placeholder:text-[#8898aa] outline-none disabled:cursor-not-allowed disabled:opacity-100';

const condensedRowClass =
  'flex min-h-[46px] w-full items-center border-0 bg-transparent px-3 text-base leading-5 text-[#1a1f36] placeholder:text-[#8898aa] outline-none disabled:cursor-not-allowed disabled:opacity-100';

const checkoutBoxClass =
  'overflow-hidden rounded-md border border-[#e6ebf1] bg-white shadow-sm';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BILLING_COUNTRIES = [
  { code: '', label: 'Country' },
  { code: 'US', label: 'United States' },
  { code: 'IN', label: 'India' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'SG', label: 'Singapore' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
];

const cardElementOptions: StripeCardElementOptions = {
  style: {
    base: {
      color: '#1a1f36',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      fontSize: '16px',
      lineHeight: '20px',
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

/** Card Elements appearance only (billing address is custom condensed UI). */
export const checkoutElementsOptions = {
  appearance: {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#1a1f36',
      colorText: '#1a1f36',
      colorDanger: '#df1b41',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      borderRadius: '6px',
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

type BillingTouched = {
  email: boolean;
  name: boolean;
  country: boolean;
  line1: boolean;
  city: boolean;
  postal: boolean;
  cardNumber: boolean;
  cardExpiry: boolean;
  cardCvc: boolean;
};

function RequiredMark() {
  return (
    <span className="text-[#df1b41]" aria-hidden="true">
      *
    </span>
  );
}

function CardElementPlaceholder() {
  return (
    <div className={`${checkoutBoxClass} overflow-hidden`} aria-hidden>
      <div className="h-[44px] animate-pulse bg-[#f0f3f7]" />
      <div className="grid grid-cols-2 border-t border-[#e6ebf1]">
        <div className="h-[44px] animate-pulse border-r border-[#e6ebf1] bg-[#f0f3f7]" />
        <div className="h-[44px] animate-pulse bg-[#f0f3f7]" />
      </div>
    </div>
  );
}

/**
 * Collects billing + card details and confirms the subscription payment intent.
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
  const [cardReady, setCardReady] = useState(false);
  const [showManualAddress, setShowManualAddress] = useState(false);

  const [billingName, setBillingName] = useState(name ?? '');
  const [billingCountry, setBillingCountry] = useState('');
  const [billingLine1, setBillingLine1] = useState('');
  const [billingLine2, setBillingLine2] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingPostal, setBillingPostal] = useState('');
  const [billingState, setBillingState] = useState('');

  const [touched, setTouched] = useState<BillingTouched>({
    email: false,
    name: false,
    country: false,
    line1: false,
    city: false,
    postal: false,
    cardNumber: false,
    cardExpiry: false,
    cardCvc: false,
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
  const cardNumberOptions: StripeCardElementOptions = {
    ...cardOptions,
    placeholder: 'XXXX XXXX XXXX XXXX',
  };

  const trimmedEmail = email.trim();
  const trimmedName = billingName.trim();
  const trimmedLine1 = billingLine1.trim();
  const trimmedLine2 = billingLine2.trim();
  const trimmedCity = billingCity.trim();
  const trimmedPostal = billingPostal.trim();
  const trimmedState = billingState.trim();

  const emailValid = emailPattern.test(trimmedEmail);
  const nameValid = trimmedName.length > 0;
  const countryValid = billingCountry.length > 0;
  const line1Valid = trimmedLine1.length > 0;
  const cityValid = !showManualAddress || trimmedCity.length > 0;
  const postalValid = !showManualAddress || trimmedPostal.length > 0;

  const billingValid =
    emailValid &&
    nameValid &&
    countryValid &&
    line1Valid &&
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

  const postalLabel = billingCountry === 'IN' ? 'PIN' : 'ZIP';

  const emailError = touched.email
    ? !trimmedEmail
      ? 'Email is required.'
      : !emailValid
        ? 'Enter a valid email address.'
        : null
    : null;

  const addressError = useMemo(() => {
    if (touched.name && !nameValid) {
      return 'Name is required.';
    }
    if (touched.country && !countryValid) {
      return 'Country is required.';
    }
    if (touched.line1 && !line1Valid) {
      return 'Address is required.';
    }
    if (showManualAddress && touched.city && !cityValid) {
      return 'City is required.';
    }
    if (showManualAddress && touched.postal && !postalValid) {
      return `${postalLabel} is required.`;
    }
    return null;
  }, [
    touched.name,
    touched.country,
    touched.line1,
    touched.city,
    touched.postal,
    nameValid,
    countryValid,
    line1Valid,
    cityValid,
    postalValid,
    showManualAddress,
    postalLabel,
  ]);

  const billingBoxInvalid = Boolean(addressError);

  const cardNumberDisplayError = touched.cardNumber
    ? cardNumberError ||
      (!cardNumberComplete ? 'Card number is required.' : null)
    : null;
  const cardExpiryDisplayError = touched.cardExpiry
    ? cardExpiryError ||
      (!cardExpiryComplete ? 'Expiry date is required.' : null)
    : null;
  const cardCvcDisplayError = touched.cardCvc
    ? cardCvcError || (!cardCvcComplete ? 'CVC is required.' : null)
    : null;

  const stripeFieldError = useMemo(
    () =>
      cardNumberDisplayError ||
      cardExpiryDisplayError ||
      cardCvcDisplayError ||
      '',
    [cardNumberDisplayError, cardExpiryDisplayError, cardCvcDisplayError],
  );

  const markTouched = (field: keyof BillingTouched) => {
    setTouched((current) => ({ ...current, [field]: true }));
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

    if (disabled || processing || !stripe || !elements || !canPay) {
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
            email: trimmedEmail,
            name: trimmedName,
            address: {
              line1: trimmedLine1,
              ...(trimmedLine2 ? { line2: trimmedLine2 } : {}),
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
      className="flex h-full min-h-screen flex-col bg-white px-6 py-12 sm:px-8 sm:py-14 lg:px-16 lg:py-16 xl:px-20"
      aria-busy={disabled || processing}
    >
      <div className="mx-auto w-full max-w-xl lg:ml-0 lg:mr-auto lg:max-w-2xl">
        <section>
          <h2 className="text-base font-semibold text-heading">Billing information</h2>
          <p className="mt-1 text-sm text-muted">
            Required fields are marked with <RequiredMark />
          </p>

          <div className="mt-5">
            <label htmlFor="checkout-email" className="block text-sm text-muted">
              Email <RequiredMark />
            </label>
            <div
              className={`mt-2 ${checkoutBoxClass} ${
                emailError ? 'border-[#df1b41]' : ''
              }`}
            >
              <input
                id="checkout-email"
                type="email"
                autoComplete="email"
                value={email}
                disabled={formLocked}
                placeholder="Email"
                aria-required="true"
                className={checkoutFieldClass}
                onChange={(event) => onEmailChange(event.target.value)}
                onBlur={() => markTouched('email')}
              />
            </div>
            {emailError ? (
              <p className="mt-1.5 text-sm text-[#df1b41]">{emailError}</p>
            ) : null}
          </div>

          <div className="mt-5">
            <p className="text-sm text-muted">
              Billing address <RequiredMark />
            </p>
            <div
              className={`mt-2 ${checkoutBoxClass} ${
                billingBoxInvalid ? 'border-[#df1b41]' : ''
              }`}
            >
              <input
                type="text"
                autoComplete="name"
                value={billingName}
                disabled={formLocked}
                placeholder="Name"
                aria-label="Name"
                aria-required="true"
                className={condensedRowClass}
                onChange={(event) => {
                  setBillingName(event.target.value);
                  onNameChange(event.target.value);
                }}
                onBlur={() => markTouched('name')}
              />

              <div className="relative border-t border-[#e6ebf1]">
                <select
                  value={billingCountry}
                  disabled={formLocked}
                  aria-label="Country"
                  aria-required="true"
                  className={`${condensedRowClass} appearance-none pr-10 ${
                    billingCountry ? 'text-[#1a1f36]' : 'text-[#8898aa]'
                  }`}
                  onChange={(event) => setBillingCountry(event.target.value)}
                  onBlur={() => markTouched('country')}
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
                autoComplete="address-line1"
                value={billingLine1}
                disabled={formLocked}
                placeholder="Address"
                aria-label="Address"
                aria-required="true"
                className={`${condensedRowClass} border-t border-[#e6ebf1]`}
                onChange={(event) => setBillingLine1(event.target.value)}
                onBlur={() => markTouched('line1')}
              />

              {showManualAddress ? (
                <>
                  <input
                    type="text"
                    autoComplete="address-line2"
                    value={billingLine2}
                    disabled={formLocked}
                    placeholder="Address line 2"
                    aria-label="Address line 2"
                    className={`${condensedRowClass} border-t border-[#e6ebf1]`}
                    onChange={(event) => setBillingLine2(event.target.value)}
                  />
                  <input
                    type="text"
                    autoComplete="address-level2"
                    value={billingCity}
                    disabled={formLocked}
                    placeholder="City"
                    aria-label="City"
                    aria-required="true"
                    className={`${condensedRowClass} border-t border-[#e6ebf1]`}
                    onChange={(event) => setBillingCity(event.target.value)}
                    onBlur={() => markTouched('city')}
                  />
                  <div className="grid grid-cols-2 border-t border-[#e6ebf1]">
                    <input
                      type="text"
                      autoComplete="postal-code"
                      value={billingPostal}
                      disabled={formLocked}
                      placeholder={postalLabel}
                      aria-label={postalLabel}
                      aria-required="true"
                      className={`${condensedRowClass} border-r border-[#e6ebf1]`}
                      onChange={(event) => setBillingPostal(event.target.value)}
                      onBlur={() => markTouched('postal')}
                    />
                    <input
                      type="text"
                      autoComplete="address-level1"
                      value={billingState}
                      disabled={formLocked}
                      placeholder="State"
                      aria-label="State"
                      className={condensedRowClass}
                      onChange={(event) => setBillingState(event.target.value)}
                    />
                  </div>
                </>
              ) : null}
            </div>

            <div className="mt-1 min-h-0" aria-live="polite">
              {addressError ? (
                <p className="text-sm text-[#df1b41]">{addressError}</p>
              ) : null}
            </div>

            <button
              type="button"
              disabled={formLocked}
              className="mt-1.5 text-sm text-[#0570de] underline underline-offset-2 hover:text-[#0451a5] disabled:cursor-not-allowed disabled:opacity-60 disabled:no-underline"
              onClick={() => setShowManualAddress((current) => !current)}
            >
              {showManualAddress
                ? 'Hide extra address fields'
                : 'Enter address manually'}
            </button>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-base font-semibold text-heading">Payment details</h2>
          <p className="mt-5 text-sm text-muted">
            Card information <RequiredMark />
          </p>
          <div className="relative mt-2 min-h-[88px]">
            {!cardReady ? (
              <div className="pointer-events-none absolute inset-0 z-10">
                <CardElementPlaceholder />
              </div>
            ) : null}
            <div className={cardReady ? 'relative' : 'invisible'}>
              <div
                className={`${checkoutBoxClass} ${
                  stripeFieldError ? 'border-[#df1b41]' : ''
                }`}
              >
                <div className="border-b border-[#e6ebf1] px-3 py-2.5">
                  <CardNumberElement
                    options={cardNumberOptions}
                    onChange={handleCardNumberChange}
                    onReady={() => setCardReady(true)}
                    onBlur={() => markTouched('cardNumber')}
                  />
                </div>
                <div className="grid grid-cols-2">
                  <div className="border-r border-[#e6ebf1] px-3 py-2.5">
                    <CardExpiryElement
                      options={cardOptions}
                      onChange={handleCardExpiryChange}
                      onBlur={() => markTouched('cardExpiry')}
                    />
                  </div>
                  <div className="px-3 py-2.5">
                    <CardCvcElement
                      options={cardOptions}
                      onChange={handleCardCvcChange}
                      onBlur={() => markTouched('cardCvc')}
                    />
                  </div>
                </div>
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
            onClick={() => undefined}
          >
            {processing
              ? 'Processing…'
              : disabled
                ? 'Updating checkout…'
                : `Pay ${formatMoney(payAmount ?? price.amount, price.currency)}`}
          </Button>
          {/* {!canPay && !processing && !disabled && !switchError ? (
            <p className="mt-2 text-center text-sm text-muted">
              Complete all required fields marked with * to continue.
            </p>
          ) : null} */}
        </div>
      </div>
    </form>
  );
}
