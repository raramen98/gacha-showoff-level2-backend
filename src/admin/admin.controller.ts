import { Controller, HttpCode, Post } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { SCHEMA } from '../db/pool';
import { reseed } from '../db/seed';

/** 과제 확인·시연용 — 현황 화면의 "가상 데이터 다시 채우기" 버튼 */
@Controller('admin')
export class AdminController {
  constructor(private readonly db: DbService) {}

  /** gacha_l2의 데이터만 지우고 다시 채운다 (다른 스키마는 건드리지 않음) */
  @Post('reseed')
  @HttpCode(200)
  async reseed() {
    const counts = await this.db.transaction((client) => reseed(client));
    return {
      message: `가상 데이터를 다시 채웠어요. 시리즈 ${counts.series}개, 자랑 글 ${counts.posts}개, 교환 신청 ${counts.trades}건`,
      schema: SCHEMA,
      counts,
    };
  }
}
