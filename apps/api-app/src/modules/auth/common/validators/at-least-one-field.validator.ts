import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ERROR_MESSAGES } from '../constants/messages';

@ValidatorConstraint({ name: 'atLeastOneField', async: false })
export class AtLeastOneFieldConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const object = args.object as Record<string, unknown>;
    const fields = args.constraints as string[];
    return fields.some(
      (field) => object[field] !== undefined && object[field] !== null,
    );
  }

  defaultMessage(args: ValidationArguments): string {
    const fields = (args.constraints as string[]).join(', ');
    return ERROR_MESSAGES.VALIDATION.AT_LEAST_ONE_FIELD(fields);
  }
}

export function AtLeastOneField(
  fields: string[],
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: fields,
      validator: AtLeastOneFieldConstraint,
    });
  };
}
