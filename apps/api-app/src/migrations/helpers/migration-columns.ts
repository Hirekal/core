import { TableColumnOptions } from 'typeorm';

export const STATUS_COLUMN: TableColumnOptions = {
  name: 'status',
  type: 'varchar',
  length: '50',
  default: "'ACTIVE'",
};

export const BASE_ENTITY_COLUMNS: TableColumnOptions[] = [
  {
    name: 'id',
    type: 'uuid',
    isPrimary: true,
    default: 'gen_random_uuid()',
  },
  {
    name: 'createdAt',
    type: 'timestamptz',
    default: 'now()',
  },
  {
    name: 'updatedAt',
    type: 'timestamptz',
    default: 'now()',
  },
  {
    name: 'deletedAt',
    type: 'timestamptz',
    isNullable: true,
  },
  {
    name: 'metadata',
    type: 'jsonb',
    isNullable: true,
    default: "'{}'",
  },
  STATUS_COLUMN,
];
