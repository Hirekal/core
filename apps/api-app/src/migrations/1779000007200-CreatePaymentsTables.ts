import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';
import { BASE_ENTITY_COLUMNS } from './helpers/migration-columns';

export class CreatePaymentsTables1779000007200 implements MigrationInterface {
  name = 'CreatePaymentsTables1779000007200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'paymentProviders',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'code', type: 'varchar', length: '50', isUnique: true },
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'description', type: 'text', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'products',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'code', type: 'varchar', length: '50', isUnique: true },
          { name: 'description', type: 'text', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'paymentCustomers',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'userId', type: 'uuid' },
          { name: 'paymentProviderId', type: 'uuid' },
          { name: 'providerCustomerId', type: 'varchar', length: '255' },
          { name: 'email', type: 'varchar', length: '255' },
          { name: 'name', type: 'varchar', length: '255', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'prices',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'productId', type: 'uuid' },
          { name: 'paymentProviderId', type: 'uuid' },
          { name: 'providerPriceId', type: 'varchar', length: '255' },
          { name: 'currency', type: 'varchar', length: '10' },
          { name: 'amount', type: 'integer' },
          {
            name: 'interval',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          { name: 'intervalCount', type: 'integer', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'subscriptions',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'userId', type: 'uuid' },
          { name: 'customerId', type: 'uuid' },
          { name: 'priceId', type: 'uuid' },
          { name: 'paymentProviderId', type: 'uuid' },
          { name: 'providerSubscriptionId', type: 'varchar', length: '255' },
          { name: 'subscriptionStatus', type: 'varchar', length: '50' },
          { name: 'currentPeriodStart', type: 'timestamptz' },
          { name: 'currentPeriodEnd', type: 'timestamptz' },
          {
            name: 'cancelAtPeriodEnd',
            type: 'boolean',
            default: false,
          },
          { name: 'canceledAt', type: 'timestamptz', isNullable: true },
          { name: 'trialStart', type: 'timestamptz', isNullable: true },
          { name: 'trialEnd', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'payments',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'userId', type: 'uuid' },
          { name: 'customerId', type: 'uuid' },
          { name: 'subscriptionId', type: 'uuid', isNullable: true },
          { name: 'paymentProviderId', type: 'uuid' },
          { name: 'providerPaymentId', type: 'varchar', length: '255' },
          { name: 'amount', type: 'integer' },
          { name: 'currency', type: 'varchar', length: '10' },
          {
            name: 'paymentMethod',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          { name: 'paymentStatus', type: 'varchar', length: '50' },
          { name: 'paidAt', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'paymentMethods',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'userId', type: 'uuid' },
          { name: 'customerId', type: 'uuid' },
          { name: 'paymentProviderId', type: 'uuid' },
          {
            name: 'providerPaymentMethodId',
            type: 'varchar',
            length: '255',
          },
          { name: 'type', type: 'varchar', length: '50' },
          { name: 'brand', type: 'varchar', length: '50', isNullable: true },
          { name: 'last4', type: 'varchar', length: '4', isNullable: true },
          { name: 'expMonth', type: 'integer', isNullable: true },
          { name: 'expYear', type: 'integer', isNullable: true },
          { name: 'isDefault', type: 'boolean', default: false },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'invoices',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'userId', type: 'uuid' },
          { name: 'subscriptionId', type: 'uuid', isNullable: true },
          { name: 'paymentId', type: 'uuid', isNullable: true },
          { name: 'paymentProviderId', type: 'uuid' },
          { name: 'providerInvoiceId', type: 'varchar', length: '255' },
          { name: 'amountDue', type: 'integer' },
          { name: 'amountPaid', type: 'integer' },
          { name: 'currency', type: 'varchar', length: '10' },
          { name: 'invoiceStatus', type: 'varchar', length: '50' },
          { name: 'invoiceUrl', type: 'varchar', length: '500', isNullable: true },
          { name: 'invoicePdf', type: 'varchar', length: '500', isNullable: true },
          { name: 'paidAt', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'webhookEvents',
        columns: [
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
          { name: 'paymentProviderId', type: 'uuid' },
          { name: 'providerEventId', type: 'varchar', length: '255' },
          { name: 'eventType', type: 'varchar', length: '255' },
          { name: 'payload', type: 'jsonb' },
          {
            name: 'processingStatus',
            type: 'varchar',
            length: '50',
            default: "'PENDING'",
          },
          { name: 'errorMessage', type: 'text', isNullable: true },
          { name: 'processedAt', type: 'timestamptz', isNullable: true },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'paymentCustomers',
      new TableIndex({
        name: 'IDX_paymentCustomers_userId_paymentProviderId',
        columnNames: ['userId', 'paymentProviderId'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'subscriptions',
      new TableIndex({
        name: 'IDX_subscriptions_providerSubscriptionId',
        columnNames: ['providerSubscriptionId'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKeys('paymentCustomers', [
      new TableForeignKey({
        columnNames: ['paymentProviderId'],
        referencedTableName: 'paymentProviders',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createForeignKeys('prices', [
      new TableForeignKey({
        columnNames: ['productId'],
        referencedTableName: 'products',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['paymentProviderId'],
        referencedTableName: 'paymentProviders',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createIndex(
      'prices',
      new TableIndex({
        name: 'IDX_prices_paymentProviderId_providerPriceId',
        columnNames: ['paymentProviderId', 'providerPriceId'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKeys('subscriptions', [
      new TableForeignKey({
        columnNames: ['customerId'],
        referencedTableName: 'paymentCustomers',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['priceId'],
        referencedTableName: 'prices',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
      new TableForeignKey({
        columnNames: ['paymentProviderId'],
        referencedTableName: 'paymentProviders',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createForeignKeys('payments', [
      new TableForeignKey({
        columnNames: ['customerId'],
        referencedTableName: 'paymentCustomers',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['subscriptionId'],
        referencedTableName: 'subscriptions',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['paymentProviderId'],
        referencedTableName: 'paymentProviders',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createForeignKeys('paymentMethods', [
      new TableForeignKey({
        columnNames: ['customerId'],
        referencedTableName: 'paymentCustomers',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['paymentProviderId'],
        referencedTableName: 'paymentProviders',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createForeignKeys('invoices', [
      new TableForeignKey({
        columnNames: ['subscriptionId'],
        referencedTableName: 'subscriptions',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['paymentId'],
        referencedTableName: 'payments',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['paymentProviderId'],
        referencedTableName: 'paymentProviders',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createForeignKeys('webhookEvents', [
      new TableForeignKey({
        columnNames: ['paymentProviderId'],
        referencedTableName: 'paymentProviders',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('webhookEvents', true);
    await queryRunner.dropTable('invoices', true);
    await queryRunner.dropTable('paymentMethods', true);
    await queryRunner.dropTable('payments', true);
    await queryRunner.dropTable('subscriptions', true);
    await queryRunner.dropTable('prices', true);
    await queryRunner.dropTable('paymentCustomers', true);
    await queryRunner.dropTable('products', true);
    await queryRunner.dropTable('paymentProviders', true);
  }
}
