import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { buildTypeOrmOptions } from './typeorm.config';

config();

/** DataSource utilisée par la CLI TypeORM (migration:generate / run / revert). */
export default new DataSource({ ...buildTypeOrmOptions(process.env), synchronize: false, migrationsRun: false });
