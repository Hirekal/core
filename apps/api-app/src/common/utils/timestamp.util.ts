import { ValueTransformer } from 'typeorm';

/** Current epoch milliseconds. */
export const nowMs = (): number => Date.now();

/** TypeORM transformer for bigint epoch-ms columns. */
export const bigintTimestampTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value ?? null,
  from: (value: string | number | null) =>
    value === null || value === undefined ? null : Number(value),
};
