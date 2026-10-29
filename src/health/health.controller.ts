import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { SCHEMA } from '../db/pool';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DbService) {}

  @Get()
  async check() {
    const checkedAt = new Date().toISOString();
    try {
      const [row] = await this.db.query<{ now: string; series: number; posts: number; trade_requests: number }>(
        `SELECT now() AS now,
                (SELECT COUNT(*) FROM ${SCHEMA}.series) AS series,
                (SELECT COUNT(*) FROM ${SCHEMA}.posts) AS posts,
                (SELECT COUNT(*) FROM ${SCHEMA}.trade_requests) AS trade_requests`,
      );
      return {
        status: 'ok',
        db: 'connected',
        message: 'DB에 잘 연결되어 있어요.',
        schema: SCHEMA,
        counts: { series: row.series, posts: row.posts, trade_requests: row.trade_requests },
        checkedAt,
      };
    } catch (error) {
      throw new ServiceUnavailableException({
        status: 'error',
        db: 'disconnected',
        message: 'DB에 연결할 수 없어요. DB 주소(.env)와 DB 서버 상태를 확인해 주세요.',
        reason: error instanceof Error ? error.message : String(error),
        checkedAt,
      });
    }
  }
}
