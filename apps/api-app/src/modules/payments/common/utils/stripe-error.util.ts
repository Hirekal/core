/**
 * @fileoverview Maps Stripe errors into application HTTP exceptions.
 */
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ERROR_MESSAGES } from '../messages/payment.messages';
import { getStripeErrorsNamespace } from './stripe-sdk.util';

const STRIPE_CODE_MESSAGES: Record<string, string> = {
  resource_missing: ERROR_MESSAGES.STRIPE.RESOURCE_MISSING,
  customer_tax_location_invalid: ERROR_MESSAGES.STRIPE.INVALID_CUSTOMER,
};

interface StripeLikeError extends Error {
  type?: string;
  code?: string;
  param?: string;
}

/**
 * Determines whether an error resembles a Stripe SDK failure.
 */
function isStripeLikeError(error: unknown): error is StripeLikeError {
  return (
    error instanceof Error &&
    typeof (error as StripeLikeError).type === 'string' &&
    (error as StripeLikeError).type?.startsWith('Stripe') === true
  );
}

/*
 * Maps Stripe SDK failures to application-level BadRequestException responses
 * while preserving non-Stripe errors for upstream handlers.
 */
export function rethrowStripeError(error: unknown): never {
  if (!(error instanceof Error)) {
    throw error;
  }

  const stripeErrors = getStripeErrorsNamespace();

  if (stripeErrors?.StripeCardError && error instanceof stripeErrors.StripeCardError) {
    throw new BadRequestException(ERROR_MESSAGES.STRIPE.PAYMENT_FAILED);
  }

  if (
    stripeErrors?.StripeInvalidRequestError &&
    error instanceof stripeErrors.StripeInvalidRequestError
  ) {
    const code = error.code ?? '';
    const message =
      STRIPE_CODE_MESSAGES[code] ??
      ERROR_MESSAGES.STRIPE.REQUEST_FAILED(error.message);

    if (error.param === 'payment_method') {
      throw new BadRequestException(
        ERROR_MESSAGES.STRIPE.MISSING_PAYMENT_METHOD,
      );
    }

    throw new BadRequestException(message);
  }

  if (stripeErrors?.StripeError && error instanceof stripeErrors.StripeError) {
    throw new BadRequestException(
      ERROR_MESSAGES.STRIPE.REQUEST_FAILED(error.message),
    );
  }

  if (isStripeLikeError(error)) {
    if (error.type === 'StripeCardError') {
      throw new BadRequestException(ERROR_MESSAGES.STRIPE.PAYMENT_FAILED);
    }

    if (error.type === 'StripeInvalidRequestError') {
      const code = error.code ?? '';
      const message =
        STRIPE_CODE_MESSAGES[code] ??
        ERROR_MESSAGES.STRIPE.REQUEST_FAILED(error.message);

      if (error.param === 'payment_method') {
        throw new BadRequestException(
          ERROR_MESSAGES.STRIPE.MISSING_PAYMENT_METHOD,
        );
      }

      throw new BadRequestException(message);
    }

    throw new BadRequestException(
      ERROR_MESSAGES.STRIPE.REQUEST_FAILED(error.message),
    );
  }

  if (error.message.includes('Stripe SDK')) {
    throw new InternalServerErrorException(error.message);
  }

  throw error;
}
