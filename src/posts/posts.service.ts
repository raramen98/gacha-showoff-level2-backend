import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { SCHEMA } from '../db/pool';
import {
  asText,
  charLength,
  detectImageType,
  FieldErrors,
  MAX_IMAGE_BYTES,
  Rarity,
  RARITIES,
  throwIfInvalid,
  UploadedImage,
} from '../common/validation';

// 사진 자체(image_data)는 목록에서 빼고, 사진을 볼 수 있는 주소만 돌려준다
// pending_trade_count = 이 아이템(받고 싶은 아이템)에 걸린 대기 중 교환 신청 수
export const POST_COLUMNS = `p.id, p.series_id, p.nickname, p.character_name, p.rarity, p.comment, p.trade_status, p.created_at,
       CASE WHEN p.image_data IS NULL THEN NULL ELSE '/posts/' || p.id || '/image' END AS image_url,
       s.ip_name, s.name AS series_name, s.price AS series_price,
       (SELECT COUNT(*) FROM ${SCHEMA}.trade_requests t
         WHERE t.target_post_id = p.id AND t.status = 'pending') AS pending_trade_count`;

/** 등록할 때 고를 수 있는 교환 상태 (교환 완료는 수락으로만 바뀐다) */
export const NEW_TRADE_STATUSES = ['available', 'not_for_trade'] as const;
export type NewTradeStatus = (typeof NEW_TRADE_STATUSES)[number];

/** GET /posts?q=&ip=&rarity=&tradable= — 비어 있는 조건은 쓰지 않는다 */
export interface PostFilters {
  q?: string;
  ip?: string;
  rarity?: string;
  tradable?: string;
  nickname?: string;
}

export interface CreatePostInput {
  series_id: number | null;
  nickname: string;
  character_name: string;
  rarity: Rarity;
  comment: string;
  trade_status: NewTradeStatus;
  image: { type: string; data: Buffer };
}

@Injectable()
export class PostsService {
  constructor(private readonly db: DbService) {}

  findAll(filters: PostFilters = {}) {
    const where: string[] = [];
    const params: unknown[] = [];
    const add = (condition: (n: string) => string, value: unknown) => {
      params.push(value);
      where.push(condition(`$${params.length}`));
    };

    const q = asText(filters.q);
    // %, _ 를 글자 그대로 찾도록 감싼다
    if (q) add((n) => `p.character_name ILIKE '%' || ${n} || '%' ESCAPE '\\'`, q.replace(/[\\%_]/g, '\\$&'));
    const ip = asText(filters.ip);
    if (ip) add((n) => `s.ip_name = ${n}`, ip);
    const rarity = asText(filters.rarity);
    if (rarity) add((n) => `p.rarity = ${n}`, rarity);
    if (['true', '1', 'on'].includes(asText(filters.tradable))) where.push(`p.trade_status = 'available'`);
    const nickname = asText(filters.nickname);
    if (nickname) add((n) => `p.nickname = ${n}`, nickname);

    return this.db.query(
      `SELECT ${POST_COLUMNS}
         FROM ${SCHEMA}.posts p
         LEFT JOIN ${SCHEMA}.series s ON s.id = p.series_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY p.created_at DESC, p.id DESC`,
      params,
    );
  }

  async findOne(id: number) {
    const [post] = await this.db.query(
      `SELECT ${POST_COLUMNS}
         FROM ${SCHEMA}.posts p
         LEFT JOIN ${SCHEMA}.series s ON s.id = p.series_id
        WHERE p.id = $1`,
      [id],
    );
    if (!post) throw new NotFoundException('찾는 자랑 글이 없어요. 주소를 다시 확인해 주세요.');
    return post;
  }

  async findImage(id: number) {
    const [row] = await this.db.query<{ image_type: string; image_data: Buffer }>(
      `SELECT image_type, image_data FROM ${SCHEMA}.posts WHERE id = $1 AND image_data IS NOT NULL`,
      [id],
    );
    if (!row) throw new NotFoundException('이 자랑 글에는 사진이 없어요.');
    return row;
  }

  async create(body: Record<string, unknown>, file?: UploadedImage) {
    const input = this.validate(body, file);

    if (input.series_id !== null) {
      const [series] = await this.db.query(`SELECT id FROM ${SCHEMA}.series WHERE id = $1`, [input.series_id]);
      if (!series) throwIfInvalid({ series_id: '고른 시리즈를 찾을 수 없어요. 시리즈를 다시 골라 주세요' });
    }

    const [created] = await this.db.query<{ id: number }>(
      `INSERT INTO ${SCHEMA}.posts (series_id, nickname, character_name, rarity, comment, trade_status, image_type, image_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        input.series_id,
        input.nickname,
        input.character_name,
        input.rarity,
        input.comment,
        input.trade_status,
        input.image.type,
        input.image.data,
      ],
    );
    return this.findOne(created.id);
  }

  private validate(body: Record<string, unknown>, file?: UploadedImage): CreatePostInput {
    // 안내 순서 = 등록 화면의 칸 순서 (사진이 맨 위)
    const errors: FieldErrors = {};
    const rawSeriesId = typeof body.series_id === 'number' ? String(body.series_id) : asText(body.series_id);
    const nickname = asText(body.nickname);
    const character_name = asText(body.character_name);
    const rarity = asText(body.rarity);
    const comment = asText(body.comment);
    const trade_status = asText(body.trade_status);

    const imageType = file ? detectImageType(file.buffer) : null;
    if (!file || file.size === 0) errors.image = '사진을 올려 주세요';
    else if (file.size > MAX_IMAGE_BYTES) errors.image = '사진은 5MB 이하로 올려 주세요';
    else if (!imageType) errors.image = '사진은 JPG, PNG, WEBP, GIF 파일만 올릴 수 있어요';

    // 시리즈는 고르지 않아도 된다. 골랐다면 올바른 번호여야 한다
    const series_id = rawSeriesId ? Number(rawSeriesId) : null;
    if (rawSeriesId && (!/^\d+$/.test(rawSeriesId) || series_id! < 1 || series_id! > 2_147_483_647))
      errors.series_id = '고른 시리즈를 찾을 수 없어요. 시리즈를 다시 골라 주세요';

    if (!nickname) errors.nickname = '닉네임을 적어 주세요';
    else if (charLength(nickname) < 2 || charLength(nickname) > 12)
      errors.nickname = '닉네임은 2~12자로 적어 주세요';

    if (!character_name) errors.character_name = '캐릭터 이름을 적어 주세요';
    else if (charLength(character_name) > 50) errors.character_name = '캐릭터 이름은 50자 이내로 적어 주세요';

    if (!rarity) errors.rarity = '레어도를 골라 주세요';
    else if (!(RARITIES as readonly string[]).includes(rarity))
      errors.rarity = '레어도는 일반, 레어, 시크릿 중에서 하나만 골라 주세요';

    if (charLength(comment) > 100) errors.comment = '한마디는 100자 이내로 적어 주세요';

    if (!trade_status) errors.trade_status = '교환 가능 여부를 골라 주세요';
    else if (!(NEW_TRADE_STATUSES as readonly string[]).includes(trade_status))
      errors.trade_status = '교환 가능 여부는 "교환 가능"이나 "교환 안 함" 중에서 골라 주세요';

    throwIfInvalid(errors);
    return {
      series_id,
      nickname,
      character_name,
      rarity: rarity as Rarity,
      comment,
      trade_status: trade_status as NewTradeStatus,
      image: { type: imageType!, data: file!.buffer },
    };
  }
}
