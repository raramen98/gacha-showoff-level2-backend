import { Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db/db.service';
import { SCHEMA } from '../db/pool';
import { POST_COLUMNS } from '../posts/posts.service';
import { asText, charLength, FieldErrors, isRealDate, throwIfInvalid } from '../common/validation';

export interface CreateSeriesInput {
  ip_name: string;
  name: string;
  price: number;
  release_date: string;
}

@Injectable()
export class SeriesService {
  constructor(private readonly db: DbService) {}

  findAll() {
    return this.db.query(
      `SELECT s.id, s.ip_name, s.name, s.price, s.release_date, s.created_at,
              COUNT(p.id) AS post_count,
              COUNT(p.id) FILTER (WHERE p.rarity = 'secret') AS secret_count
         FROM ${SCHEMA}.series s
         LEFT JOIN ${SCHEMA}.posts p ON p.series_id = s.id
        GROUP BY s.id
        ORDER BY s.ip_name, s.release_date DESC, s.id`,
    );
  }

  async findOne(id: number) {
    const [series] = await this.db.query(
      `SELECT id, ip_name, name, price, release_date, created_at FROM ${SCHEMA}.series WHERE id = $1`,
      [id],
    );
    if (!series) throw new NotFoundException('찾는 시리즈가 없어요. 주소를 다시 확인해 주세요.');

    const posts = await this.db.query(
      `SELECT ${POST_COLUMNS}
         FROM ${SCHEMA}.posts p
         JOIN ${SCHEMA}.series s ON s.id = p.series_id
        WHERE p.series_id = $1
        ORDER BY p.created_at DESC, p.id DESC`,
      [id],
    );
    const rarityCounts = { common: 0, rare: 0, secret: 0 };
    for (const post of posts) rarityCounts[post.rarity as keyof typeof rarityCounts] += 1;

    return { ...series, rarity_counts: rarityCounts, posts };
  }

  async create(body: Record<string, unknown>) {
    const input = this.validate(body);
    const [created] = await this.db.query(
      `INSERT INTO ${SCHEMA}.series (ip_name, name, price, release_date)
       VALUES ($1, $2, $3, $4)
       RETURNING id, ip_name, name, price, release_date, created_at`,
      [input.ip_name, input.name, input.price, input.release_date],
    );
    return created;
  }

  private validate(body: Record<string, unknown>): CreateSeriesInput {
    const errors: FieldErrors = {};
    const ip_name = asText(body.ip_name);
    const name = asText(body.name);
    const release_date = asText(body.release_date);
    const rawPrice = typeof body.price === 'number' ? String(body.price) : asText(body.price);

    if (!ip_name) errors.ip_name = '작품 이름을 적어 주세요';
    else if (charLength(ip_name) > 30) errors.ip_name = '작품 이름은 30자 이내로 적어 주세요';

    if (!name) errors.name = '시리즈 이름을 적어 주세요';
    else if (charLength(name) > 60) errors.name = '시리즈 이름은 60자 이내로 적어 주세요';

    const price = Number(rawPrice);
    if (!rawPrice) errors.price = '1회 가격을 적어 주세요';
    else if (!/^\d+$/.test(rawPrice) || price > 1_000_000)
      errors.price = '1회 가격은 0~1,000,000 사이의 숫자로 적어 주세요 (예: 5000)';

    if (!release_date) errors.release_date = '출시일을 적어 주세요';
    else if (!isRealDate(release_date)) errors.release_date = '출시일을 올바르게 적어 주세요 (예: 2026-09-01)';

    throwIfInvalid(errors);
    return { ip_name, name, price, release_date };
  }
}
