import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { parseId } from '../common/validation';
import { TradesService } from './trades.service';

const NOT_FOUND = '찾는 교환 신청이 없어요. 내 교환 화면을 새로고침해 주세요.';

/**
 * 로그인은 Level 3 범위라서, 누가 요청했는지는 화면 위 "지금 나는"에서 고른 닉네임을 본문에 담아 보낸다.
 * - 신청: requester_nickname / 취소·수락·거절: nickname
 */
@Controller('trades')
export class TradesController {
  constructor(private readonly trades: TradesService) {}

  @Get()
  list(@Query('nickname') nickname: unknown) {
    return this.trades.listFor(nickname);
  }

  @Post()
  create(@Body() body: Record<string, unknown> = {}) {
    return this.trades.create(body ?? {});
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Body() body: Record<string, unknown> = {}) {
    return this.trades.cancel(parseId(id, NOT_FOUND), body ?? {});
  }

  @Patch(':id/accept')
  accept(@Param('id') id: string, @Body() body: Record<string, unknown> = {}) {
    return this.trades.accept(parseId(id, NOT_FOUND), body ?? {});
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string, @Body() body: Record<string, unknown> = {}) {
    return this.trades.reject(parseId(id, NOT_FOUND), body ?? {});
  }
}
