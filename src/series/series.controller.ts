import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { parseId } from '../common/validation';
import { SeriesService } from './series.service';

@Controller('series')
export class SeriesController {
  constructor(private readonly series: SeriesService) {}

  @Get()
  findAll() {
    return this.series.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.series.findOne(parseId(id, '찾는 시리즈가 없어요. 주소를 다시 확인해 주세요.'));
  }

  @Post()
  create(@Body() body: Record<string, unknown> = {}) {
    return this.series.create(body ?? {});
  }
}
