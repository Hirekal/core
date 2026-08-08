import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';
import { BASE_ENTITY_COLUMNS } from './helpers/migration-columns';

export class AddCouponRedemptionTracking1779000008000
  implements MigrationInterface
{
  name = 'AddCouponRedemptionTracking1779000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'paymentCouponCodes',
      new TableColumn({
        name: 'timesRedeemed',
        type: 'integer',
        default: 0,
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'paymentCouponRedemptions',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'couponId', type: 'uuid' },
          { name: 'organizationId', type: 'uuid' },
          { name: 'promotionCode', type: 'varchar', length: '100' },
          { name: 'providerInvoiceId', type: 'varchar', length: '255' },
          {
            name: 'providerSubscriptionId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'paymentCouponRedemptions',
      new TableIndex({
        name: 'IDX_paymentCouponRedemptions_providerInvoiceId',
        columnNames: ['providerInvoiceId'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'paymentCouponRedemptions',
      new TableForeignKey({
        columnNames: ['couponId'],
        referencedTableName: 'paymentCouponCodes',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('paymentCouponRedemptions', true);
    await queryRunner.dropColumn('paymentCouponCodes', 'timesRedeemed');
  }
}
