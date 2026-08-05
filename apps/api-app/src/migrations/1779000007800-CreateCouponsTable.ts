import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';
import { BASE_ENTITY_COLUMNS } from './helpers/migration-columns';

export class CreateCouponsTable1779000007800 implements MigrationInterface {
  name = 'CreateCouponsTable1779000007800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'paymentCouponCodes',
        columns: [
          ...BASE_ENTITY_COLUMNS,
          { name: 'name', type: 'varchar', length: '255' },
          { name: 'paymentProviderId', type: 'uuid' },
          { name: 'providerCouponId', type: 'varchar', length: '255' },
          {
            name: 'providerPromotionCodeId',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'promotionCode',
            type: 'varchar',
            length: '100',
            isUnique: true,
          },
          { name: 'discountType', type: 'varchar', length: '50' },
          { name: 'discountValue', type: 'integer' },
          { name: 'duration', type: 'varchar', length: '50' },
          {
            name: 'maximumRedemptions',
            type: 'integer',
            isNullable: true,
          },
          {
            name: 'expiresAt',
            type: 'timestamptz',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'paymentCouponCodes',
      new TableIndex({
        name: 'IDX_paymentCouponCodes_paymentProviderId_providerCouponId',
        columnNames: ['paymentProviderId', 'providerCouponId'],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      'paymentCouponCodes',
      new TableForeignKey({
        columnNames: ['paymentProviderId'],
        referencedTableName: 'paymentProviders',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('paymentCouponCodes', true);
  }
}
