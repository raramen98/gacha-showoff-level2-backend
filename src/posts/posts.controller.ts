import { Body, Controller, Get, Param, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { MAX_IMAGE_BYTES, parseId, UploadedImage } from '../common/validation';
import { PostFilters, PostsService } from './posts.service';

const NOT_FOUND = '찾는 자랑 글이 없어요. 주소를 다시 확인해 주세요.';

@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  /** 검색·필터: q(캐릭터 이름), ip(작품), rarity(레어도), tradable=true(교환 가능만), nickname(올린 사람) */
  @Get()
  findAll(@Query() filters: PostFilters) {
    return this.posts.findAll(filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.posts.findOne(parseId(id, NOT_FOUND));
  }

  @Get(':id/image')
  async image(@Param('id') id: string, @Res() res: Response) {
    const { image_type, image_data } = await this.posts.findImage(parseId(id, NOT_FOUND));
    res.set({
      'Content-Type': image_type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(image_data);
  }

  /** multipart/form-data로 받는다: image(사진 파일) + 나머지 칸 */
  @Post()
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 10 } }))
  create(@Body() body: Record<string, unknown> = {}, @UploadedFile() image?: UploadedImage) {
    return this.posts.create(body ?? {}, image);
  }
}
