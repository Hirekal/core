import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApplicationFieldValue } from '../entities/application-field-value.entity';

@Injectable()
export class ApplicationFieldValueRepository {
  constructor(
    @InjectRepository(ApplicationFieldValue)
    private readonly repository: Repository<ApplicationFieldValue>,
  ) {}

  /**
   * Upserts a value for a given application and field.
   * @param applicationId - The ID of the application.
   * @param applicationFieldId - The ID of the field.
   * @param value - The value to upsert.
   * @returns The upserted application field value.
   */
  async upsert(
    applicationId: string,
    applicationFieldId: string,
    value: string | null,
  ): Promise<ApplicationFieldValue> {
    const existing = await this.repository.findOne({
      where: { applicationId, applicationFieldId },
    });

    if (existing) {
      existing.value = value;
      existing.updatedAt = new Date();
      return this.repository.save(existing);
    }

    const created = this.repository.create({
      applicationId,
      applicationFieldId,
      value,
    });
    return this.repository.save(created);
  }

  /**
   * Finds all values for a given application.
   * @param applicationId - The ID of the application.
   * @returns The values for the application.
   */
  async findByApplicationId(
    applicationId: string,
  ): Promise<ApplicationFieldValue[]> {
    return this.repository.find({ where: { applicationId } });
  }
}
