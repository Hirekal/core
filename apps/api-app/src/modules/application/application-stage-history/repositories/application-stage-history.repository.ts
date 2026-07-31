import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApplicationStageHistory } from '../entities/application-stage-history.entity';

@Injectable()
export class ApplicationStageHistoryRepository {
	constructor(
		@InjectRepository(ApplicationStageHistory)
		private readonly repository: Repository<ApplicationStageHistory>,
	) { }

	/**
	 * Records a new application stage history entry.
	 * @param data - The data for the application stage history entry.
	 * @returns The created application stage history entry.
	 */
	async record(data: {
		applicationId: string;
		fromStageId: string | null;
		toStageId: string;
		changedById: string | null;
	}): Promise<ApplicationStageHistory> {
		const entry = this.repository.create({
			...data,
			changedAt: new Date(),
		});
		return this.repository.save(entry);
	}
}
