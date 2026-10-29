import { Controller, Get } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { SCHEMA } from '../db/pool';
import { USERS } from '../db/seed';

/** 기획서 9. 현황 화면 숫자 3개 — "오늘"은 한국 시간 기준 */
@Controller('stats')
export class StatsController {
  constructor(private readonly db: DbService) {}

  @Get()
  async stats() {
    const [counts] = await this.db.query<{ today_posts: number; pending_trades: number }>(
      `SELECT (SELECT COUNT(*) FROM ${SCHEMA}.posts
                WHERE (created_at AT TIME ZONE 'Asia/Seoul')::date = (now() AT TIME ZONE 'Asia/Seoul')::date) AS today_posts,
              (SELECT COUNT(*) FROM ${SCHEMA}.trade_requests WHERE status = 'pending') AS pending_trades`,
    );
    // 자랑 글 수가 같으면 최근에 나온 시리즈를 먼저
    const [topSeries] = await this.db.query(
      `SELECT s.id, s.ip_name, s.name, COUNT(p.id) AS post_count
         FROM ${SCHEMA}.series s
         JOIN ${SCHEMA}.posts p ON p.series_id = s.id
        GROUP BY s.id
        ORDER BY post_count DESC, s.release_date DESC, s.id
        LIMIT 1`,
    );
    return { today_posts: counts.today_posts, pending_trades: counts.pending_trades, top_series: topSeries ?? null };
  }
}

/** 화면 위 "지금 나는: [닉네임 ▼]"에 보여 줄 닉네임 — 가상 사용자 8명 + 새로 글을 올린 사람 */
@Controller('users')
export class UsersController {
  constructor(private readonly db: DbService) {}

  @Get()
  async list() {
    const rows = await this.db.query<{ nickname: string }>(
      `SELECT DISTINCT nickname FROM ${SCHEMA}.posts WHERE nickname <> ALL($1) ORDER BY nickname`,
      [USERS],
    );
    return [...USERS, ...rows.map((row) => row.nickname)];
  }
}
