import {
  EntityTarget,
  In,
  MigrationInterface,
  ObjectLiteral,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';
import { User } from '../modules/auth/users/entities/user.entity';
import { PaymentCustomer } from '../modules/payments/payment-customers/entities/payment-customer.entity';
import { Subscription } from '../modules/payments/subscriptions/entities/subscription.entity';
import { Payment } from '../modules/payments/payments-record/entities/payment.entity';
import { PaymentMethod } from '../modules/payments/payment-methods/entities/payment-method.entity';
import { Invoice } from '../modules/payments/invoices/entities/invoice.entity';

const OWNERSHIP_ENTITIES = [
  { table: 'paymentCustomers', entity: PaymentCustomer },
  { table: 'subscriptions', entity: Subscription },
  { table: 'payments', entity: Payment },
  { table: 'paymentMethods', entity: PaymentMethod },
  { table: 'invoices', entity: Invoice },
] as const;

const ORGANIZATION_INDEXES = [
  {
    table: 'subscriptions',
    name: 'IDX_subscriptions_organizationId',
    columnNames: ['organizationId'],
    isUnique: false,
  },
  {
    table: 'payments',
    name: 'IDX_payments_organizationId',
    columnNames: ['organizationId'],
    isUnique: false,
  },
  {
    table: 'paymentMethods',
    name: 'IDX_paymentMethods_organizationId',
    columnNames: ['organizationId'],
    isUnique: false,
  },
  {
    table: 'invoices',
    name: 'IDX_invoices_organizationId',
    columnNames: ['organizationId'],
    isUnique: false,
  },
] as const;

export class PaymentOwnershipToOrganization1779000007700
  implements MigrationInterface
{
  name = 'PaymentOwnershipToOrganization1779000007700';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { table } of OWNERSHIP_ENTITIES) {
      await queryRunner.addColumn(
        table,
        new TableColumn({
          name: 'organizationId',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }

    for (const { table, entity } of OWNERSHIP_ENTITIES) {
      await this.backfillOrganizationIdFromUserId(queryRunner, table, entity);
      await queryRunner.changeColumn(
        table,
        'organizationId',
        new TableColumn({
          name: 'organizationId',
          type: 'uuid',
          isNullable: false,
        }),
      );
    }

    await this.mergeDuplicatePaymentCustomers(queryRunner);

    await queryRunner.dropIndex(
      'paymentCustomers',
      'IDX_paymentCustomers_userId_paymentProviderId',
    );

    for (const { table } of OWNERSHIP_ENTITIES) {
      await queryRunner.dropColumn(table, 'userId');
    }

    await queryRunner.createIndex(
      'paymentCustomers',
      new TableIndex({
        name: 'IDX_paymentCustomers_organizationId_paymentProviderId',
        columnNames: ['organizationId', 'paymentProviderId'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'paymentCustomers',
      new TableForeignKey({
        columnNames: ['organizationId'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    for (const index of ORGANIZATION_INDEXES) {
      await queryRunner.createIndex(
        index.table,
        new TableIndex({
          name: index.name,
          columnNames: [...index.columnNames],
          isUnique: index.isUnique,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { table } of OWNERSHIP_ENTITIES) {
      await queryRunner.addColumn(
        table,
        new TableColumn({
          name: 'userId',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }

    for (const { table, entity } of OWNERSHIP_ENTITIES) {
      await this.backfillUserIdFromOrganizationId(queryRunner, table, entity);
      await queryRunner.changeColumn(
        table,
        'userId',
        new TableColumn({
          name: 'userId',
          type: 'uuid',
          isNullable: false,
        }),
      );
    }

    const paymentCustomersTable = await queryRunner.getTable('paymentCustomers');
    const organizationForeignKey = paymentCustomersTable?.foreignKeys.find(
      (foreignKey) => foreignKey.columnNames.includes('organizationId'),
    );
    if (organizationForeignKey) {
      await queryRunner.dropForeignKey('paymentCustomers', organizationForeignKey);
    }

    for (const index of [...ORGANIZATION_INDEXES].reverse()) {
      await queryRunner.dropIndex(index.table, index.name);
    }

    await queryRunner.dropIndex(
      'paymentCustomers',
      'IDX_paymentCustomers_organizationId_paymentProviderId',
    );

    await queryRunner.createIndex(
      'paymentCustomers',
      new TableIndex({
        name: 'IDX_paymentCustomers_userId_paymentProviderId',
        columnNames: ['userId', 'paymentProviderId'],
        isUnique: true,
      }),
    );

    for (const { table } of OWNERSHIP_ENTITIES) {
      await queryRunner.dropColumn(table, 'organizationId');
    }
  }

  private async backfillOrganizationIdFromUserId(
    queryRunner: QueryRunner,
    tableName: string,
    entity: EntityTarget<ObjectLiteral>,
  ): Promise<void> {
    const rows = await queryRunner.manager
      .createQueryBuilder()
      .select('record.id', 'id')
      .addSelect('record.userId', 'userId')
      .from(tableName, 'record')
      .where('record.userId IS NOT NULL')
      .getRawMany<{ id: string; userId: string }>();

    if (rows.length === 0) {
      return;
    }

    const organizationIdByUserId = await this.loadOrganizationIdByUserId(
      queryRunner,
      rows.map((row) => row.userId),
    );

    for (const row of rows) {
      const organizationId = organizationIdByUserId.get(row.userId);
      if (!organizationId) {
        continue;
      }

      await queryRunner.manager.update(
        entity,
        { id: row.id },
        { organizationId },
      );
    }
  }

  private async backfillUserIdFromOrganizationId(
    queryRunner: QueryRunner,
    tableName: string,
    entity: EntityTarget<ObjectLiteral>,
  ): Promise<void> {
    const rows = await queryRunner.manager
      .createQueryBuilder()
      .select('record.id', 'id')
      .addSelect('record.organizationId', 'organizationId')
      .from(tableName, 'record')
      .where('record.organizationId IS NOT NULL')
      .getRawMany<{ id: string; organizationId: string }>();

    if (rows.length === 0) {
      return;
    }

    const userIdByOrganizationId = await this.loadPrimaryUserIdByOrganizationId(
      queryRunner,
      rows.map((row) => row.organizationId),
    );

    for (const row of rows) {
      const userId = userIdByOrganizationId.get(row.organizationId);
      if (!userId) {
        continue;
      }

      await queryRunner.manager
        .createQueryBuilder()
        .update(tableName)
        .set({ userId })
        .where('id = :id', { id: row.id })
        .execute();
    }
  }

  private async loadOrganizationIdByUserId(
    queryRunner: QueryRunner,
    userIds: string[],
  ): Promise<Map<string, string>> {
    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length === 0) {
      return new Map();
    }

    const users = await queryRunner.manager.find(User, {
      where: { id: In(uniqueUserIds) },
      select: ['id', 'organizationId'],
    });

    return new Map(users.map((user) => [user.id, user.organizationId]));
  }

  private async loadPrimaryUserIdByOrganizationId(
    queryRunner: QueryRunner,
    organizationIds: string[],
  ): Promise<Map<string, string>> {
    const uniqueOrganizationIds = [...new Set(organizationIds)];
    if (uniqueOrganizationIds.length === 0) {
      return new Map();
    }

    const users = await queryRunner.manager.find(User, {
      where: { organizationId: In(uniqueOrganizationIds) },
      select: ['id', 'organizationId', 'createdAt'],
      order: { createdAt: 'ASC' },
    });

    const userIdByOrganizationId = new Map<string, string>();
    for (const user of users) {
      if (!userIdByOrganizationId.has(user.organizationId)) {
        userIdByOrganizationId.set(user.organizationId, user.id);
      }
    }

    return userIdByOrganizationId;
  }

  private async mergeDuplicatePaymentCustomers(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const customers = await queryRunner.manager.find(PaymentCustomer, {
      select: ['id', 'organizationId', 'paymentProviderId', 'createdAt'],
      order: { createdAt: 'ASC' },
    });

    const keepByKey = new Map<string, string>();
    const duplicates: Array<{ duplicateId: string; keepId: string }> = [];

    for (const customer of customers) {
      const key = `${customer.organizationId}:${customer.paymentProviderId}`;
      const keepId = keepByKey.get(key);

      if (!keepId) {
        keepByKey.set(key, customer.id);
        continue;
      }

      duplicates.push({
        duplicateId: customer.id,
        keepId,
      });
    }

    for (const { duplicateId, keepId } of duplicates) {
      await queryRunner.manager.update(
        Subscription,
        { customerId: duplicateId },
        { customerId: keepId },
      );
      await queryRunner.manager.update(
        Payment,
        { customerId: duplicateId },
        { customerId: keepId },
      );
      await queryRunner.manager.update(
        PaymentMethod,
        { customerId: duplicateId },
        { customerId: keepId },
      );
    }

    if (duplicates.length === 0) {
      return;
    }

    await queryRunner.manager.delete(PaymentCustomer, {
      id: In(duplicates.map(({ duplicateId }) => duplicateId)),
    });
  }
}
