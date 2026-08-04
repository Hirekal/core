import { Logger } from '@nestjs/common';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

const logger = new Logger('WordCountUtil');

/**
 * Count whitespace-separated words in a string.
 * @param value - Input string to count words in.
 * @returns Number of whitespace-separated words.
 */
export function countWords(value: string): number {
  try {
    const trimmed = value?.trim() ?? '';
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  } catch (error) {
    logger.error(`countWords failed: ${(error as Error).message}`);
    throw error;
  }
}

/**
 * class-validator decorator: string must have at most `max` words.
 * @param max - Maximum allowed word count.
 * @param validationOptions - Optional class-validator options.
 * @returns Property decorator that enforces the max word count.
 */
export function MaxWords(max: number, validationOptions?: ValidationOptions) {
  try {
    return function (object: object, propertyName: string) {
      registerDecorator({
        name: 'maxWords',
        target: object.constructor,
        propertyName,
        constraints: [max],
        options: validationOptions,
        validator: {
          validate(value: unknown, args: ValidationArguments) {
            try {
              if (typeof value !== 'string') return false;
              return countWords(value) <= (args.constraints[0] as number);
            } catch (error) {
              logger.error(
                `MaxWords.validate failed: ${(error as Error).message}`,
              );
              throw error;
            }
          },
          defaultMessage(args: ValidationArguments) {
            try {
              return `${args.property} must be at most ${args.constraints[0]} words`;
            } catch (error) {
              logger.error(
                `MaxWords.defaultMessage failed: ${(error as Error).message}`,
              );
              throw error;
            }
          },
        },
      });
    };
  } catch (error) {
    logger.error(`MaxWords failed: ${(error as Error).message}`);
    throw error;
  }
}
