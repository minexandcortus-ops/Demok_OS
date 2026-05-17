import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Vote } from './votes/vote.entity';
import { VoteRegistry } from './votes/vote-registry.entity';
import { VoteUrna } from './votes/vote-choice.entity';
import { VoteChoice } from './votes/vote.types';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Migration script to move votes from legacy 'Vote' table 
 * to the new 'Double Registry' (VoteRegistry + VoteUrna).
 */
async function migrate() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const voteRepo = app.get<Repository<Vote>>(getRepositoryToken(Vote));
  const registryRepo = app.get<Repository<VoteRegistry>>(getRepositoryToken(VoteRegistry));
  const urnaRepo = app.get<Repository<VoteUrna>>(getRepositoryToken(VoteUrna));

  const secret = process.env.VOTE_SECRET;
  if (!secret) {
    console.error('ERROR: VOTE_SECRET not found in .env');
    process.exit(1);
  }

  const legacyVotes = await voteRepo.find({ relations: ['citizen', 'law'] });
  console.log(`Found ${legacyVotes.length} legacy votes to migrate...`);

  for (const v of legacyVotes) {
    if (!v.citizen || !v.law) continue;

    // Generate token
    const token = crypto
      .createHmac('sha256', secret)
      .update(`${v.citizen.id}:${v.law.id}`)
      .digest('hex');

    // 1. Create Registry entry
    const registry = new VoteRegistry();
    registry.citizen = v.citizen;
    registry.law = v.law;
    registry.votedAt = v.createdAt;

    // 2. Create Urna entry
    const urna = new VoteUrna();
    urna.voterToken = token;
    urna.law = v.law;
    urna.choice = v.choice as any;
    urna.createdAt = v.createdAt;

    try {
      await registryRepo.save(registry);
      await urnaRepo.save(urna);
      console.log(`Migrated vote for Citizen ${v.citizen.pseudo} on Law ${v.law.id}`);
    } catch (e) {
      console.warn(`Skipping migrated vote (already exists): ${v.id}`);
    }
  }

  console.log('Migration completed successfully.');
  await app.close();
}

migrate();
