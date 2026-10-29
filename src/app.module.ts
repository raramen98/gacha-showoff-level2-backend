import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { DbModule } from './db/db.module';
import { HealthModule } from './health/health.module';
import { PostsModule } from './posts/posts.module';
import { SeriesModule } from './series/series.module';
import { StatsModule } from './stats/stats.module';
import { TradesModule } from './trades/trades.module';

@Module({
  imports: [DbModule, HealthModule, SeriesModule, PostsModule, TradesModule, StatsModule, AdminModule],
})
export class AppModule {}
