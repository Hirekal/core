/**
 * @fileoverview Checkout payment form with Stripe Checkout-style billing + Card Elements.
 *
 * Billing address uses Stripe's native Address Element while card fields stay on
 * Stripe Elements. Billing details are passed into confirmCardPayment.
 */
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AddressElement,
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import type {
  StripeAddressElementChangeEvent,
  StripeAddressElementOptions,
  StripeCardCvcElementChangeEvent,
  StripeCardElementOptions,
  StripeCardExpiryElementChangeEvent,
  StripeCardNumberElementChangeEvent,
  StripeCardNumberElementOptions,
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

const checkoutBoxClass =
  'overflow-hidden rounded-md border border-[#e6ebf1] bg-white shadow-sm';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

/** Card Elements appearance with limited Address Element dropdown styling. */
export const checkoutElementsOptions = {
  appearance: {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#1a1f36',
      colorText: '#1a1f36',
      colorDanger: '#df1b41',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    },
    rules: {
      '.Dropdown': {
        backgroundColor: '#ffffff',
        borderColor: '#e5e7eb',
        borderWidth: '1px',
        borderRadius: '8px',
        boxShadow: 'none',
        color: '#1a1f36',
        fontSize: '14px',
        lineHeight: '20px',
        paddingTop: '12px',
        paddingBottom: '12px',
        paddingLeft: '12px',
        paddingRight: '12px',
      },
      '.Dropdown:hover': {
        borderColor: '#d1d5db',
      },
      '.Dropdown:focus': {
        borderColor: '#1a1f36',
        boxShadow: '0 0 0 2px rgba(26, 31, 54, 0.12)',
      },
      '.Dropdown--invalid': {
        borderColor: '#df1b41',
        boxShadow: '0 0 0 2px rgba(223, 27, 65, 0.12)',
      },
      '.DropdownItem--highlight': {
        backgroundColor: '#f3f4f6',
        color: '#1a1f36',
      },
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
  /** When true, no card payment is needed — confirm applies the plan change. */
  zeroDueConfirm?: boolean;
  successMessage?: string;
  navigationState?: Record<string, unknown>;
  prepareCheckout?: () => Promise<{
    clientSecret: string | null;
    providerSubscriptionId: string;
    paymentRequired?: boolean;
  }>;
  onCheckoutFailed?: () => Promise<void>;
  onCheckoutSucceeded?: () => void;
  switchError?: string;
  disabled?: boolean;
  /** Notifies parent when Pay/confirm is in flight so summary actions can lock. */
  onProcessingChange?: (processing: boolean) => void;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
}

type BillingTouched = {
  email: boolean;
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
  zeroDueConfirm = false,
  successMessage = 'Subscription activated successfully',
  navigationState,
  prepareCheckout,
  onCheckoutFailed,
  onCheckoutSucceeded,
  switchError = '',
  disabled = false,
  onProcessingChange,
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
  const [billingName, setBillingName] = useState(name ?? '');
  const [billingAddressComplete, setBillingAddressComplete] = useState(false);
  const [touched, setTouched] = useState<BillingTouched>({
    email: false,
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

  useEffect(() => {
    onProcessingChange?.(processing);
  }, [onProcessingChange, processing]);

  const formLocked = disabled || processing;
  const billingAddressOptions = useMemo<StripeAddressElementOptions>(
    () => ({
      mode: 'billing',
      defaultValues: billingName ? { name: billingName } : undefined,
    }),
    [billingName],
  );
  const cardOptions: StripeCardElementOptions = {
    ...cardElementOptions,
    disabled: formLocked,
  };
  const cardNumberOptions: StripeCardNumberElementOptions = {
    ...cardOptions,
    placeholder: 'XXXX XXXX XXXX XXXX',
  };

  const trimmedEmail = email.trim();
  const trimmedName = billingName.trim();

  const emailValid = emailPattern.test(trimmedEmail);

  const stripePaymentValid =
    cardNumberComplete &&
    cardExpiryComplete &&
    cardCvcComplete &&
    !cardNumberError &&
    !cardExpiryError &&
    !cardCvcError;

  const canPay = Boolean(
    !formLocked &&
      !switchError &&
      emailValid &&
      billingAddressComplete &&
      (zeroDueConfirm || (stripe && elements && stripePaymentValid)),
  );

  const emailError = touched.email
    ? !trimmedEmail
      ? 'Email is required.'
      : !emailValid
        ? 'Enter a valid email address.'
        : null
    : null;

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

  const handleBillingAddressChange = (event: StripeAddressElementChangeEvent) => {
    setBillingAddressComplete(event.complete);
    setBillingName(event.value.name ?? '');
    onNameChange(event.value.name ?? '');
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

    if (disabled || processing || !canPay) {
      return;
    }

    if (!zeroDueConfirm && (!stripe || !elements)) {
      return;
    }

    setProcessing(true);
    let checkoutPrepared = false;

    try {
      let resolvedClientSecret = clientSecret ?? null;
      let resolvedProviderSubscriptionId = providerSubscriptionId;
      let paymentRequired = !zeroDueConfirm;

      if (prepareCheckout) {
        const checkoutSession = await prepareCheckout();
        resolvedClientSecret = checkoutSession.clientSecret;
        resolvedProviderSubscriptionId = checkoutSession.providerSubscriptionId;
        paymentRequired =
          checkoutSession.paymentRequired ??
          Boolean(checkoutSession.clientSecret);
        checkoutPrepared = true;
      }

      if (!resolvedProviderSubscriptionId) {
        throw new Error('Checkout is missing required Stripe configuration');
      }

      if (zeroDueConfirm && paymentRequired) {
        throw new Error(
          'A charge is required for this upgrade. Please refresh the page and try again.',
        );
      }

      if (!paymentRequired) {
        onCheckoutSucceeded?.();

        const subscription = await billingService.syncCheckoutSubscription(
          resolvedProviderSubscriptionId,
        );

        if (!isBillableSubscription(subscription)) {
          throw new Error(
            'Your plan was updated but your subscription is still activating. Please wait a moment and refresh the plans page.',
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
        return;
      }

      if (!resolvedClientSecret || !stripe || !elements) {
        throw new Error('Checkout is missing required Stripe configuration');
      }

      const billingAddressElement = elements.getElement(AddressElement);
      if (!billingAddressElement) {
        throw new Error('Billing address is not ready yet.');
      }

      const billingAddressResult = await billingAddressElement.getValue();
      if (!billingAddressResult.complete) {
        return;
      }

      const billingAddressValue = billingAddressResult.value;
      const billingAddress = {
        line1: billingAddressValue.address.line1,
        ...(billingAddressValue.address.line2
          ? { line2: billingAddressValue.address.line2 }
          : {}),
        city: billingAddressValue.address.city,
        state: billingAddressValue.address.state,
        postal_code: billingAddressValue.address.postal_code,
        country: billingAddressValue.address.country,
      };

      await billingService.updateMyPaymentCustomer({
        paymentProviderId: price.paymentProviderId,
        email: trimmedEmail,
        name: billingAddressValue.name || trimmedName,
        address: billingAddress,
      });

      const cardNumberElement = elements.getElement(CardNumberElement);
      if (!cardNumberElement) {
        throw new Error('Card details are not ready yet.');
      }

      const confirmation = await stripe.confirmCardPayment(resolvedClientSecret, {
          payment_method: {
            card: cardNumberElement,
            billing_details: {
              email: trimmedEmail,
              name: billingAddressValue.name || trimmedName,
              address: billingAddress,
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
          {/* <p className="mt-1 text-sm text-muted">
            Required fields are marked with <RequiredMark />
          </p> */}

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
            <div className="mt-2">
              <div className="py-3">
                <AddressElement
                  options={billingAddressOptions}
                  onChange={handleBillingAddressChange}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-base font-semibold text-heading">Payment details</h2>
          {zeroDueConfirm ? (
            <p className="mt-5 text-sm text-muted">
              No charge due today — confirm to switch plans.
            </p>
          ) : (
            <>
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
            </>
          )}
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
                : zeroDueConfirm
                  ? 'Confirm upgrade — no charge today'
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
