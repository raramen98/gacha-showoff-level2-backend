import { Module } from '@nestjs/common';
import { StatsController, UsersController } from './stats.controller';

@Module({ controllers: [StatsController, UsersController] })
export class StatsModule {}
