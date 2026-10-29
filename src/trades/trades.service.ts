import { ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { DbService } from '../db/db.service';
import { SCHEMA } from '../db/pool';
import { asText, charLength, FieldErrors, throwIfInvalid } from '../common/validation';

export type TradeStatus = 'pending' | 'accepted' | 'rejected' | 'canceled';

// "이 신청은 이미 ○○" 안내에 쓰는 말
const STATUS_DONE: Record<TradeStatus, string> = {
  pending: '대기 중이에요',
  accepted: '수락됐어요',
  rejected: '거절됐어요',
  canceled: '취소됐어요',
};

/** 한 사람이 동시에 걸어 둘 수 있는 대기 중 신청 수 (규칙 4) */
export const MAX_PENDING_PER_PERSON = 3;

// 기획서 7. 규칙 — 거절할 때 그대로 보여 줄 안내 문장
export const RULE_MESSAGES = {
  1: '내가 올린 아이템에는 교환 신청을 할 수 없어요.',
  2: '이미 이 아이템에 교환을 신청했어요. 내 교환에서 확인해 주세요.',
  3: '이 아이템은 지금 교환할 수 없어요.',
  4: `교환 신청은 동시에 ${MAX_PENDING_PER_PERSON}건까지만 할 수 있어요. 기존 신청을 정리해 주세요.`,
  5: '내 아이템 중 교환 가능한 것만 내놓을 수 있어요.',
} as const;

/** 규칙에 걸리면 400 + 몇 번 규칙인지 함께 돌려준다 */
function ruleBroken(rule: keyof typeof RULE_MESSAGES): never {
  throw new HttpException({ statusCode: 400, message: RULE_MESSAGES[rule], rule }, HttpStatus.BAD_REQUEST);
}

const TRADE_NOT_FOUND = '찾는 교환 신청이 없어요. 내 교환 화면을 새로고침해 주세요.';
const POST_NOT_FOUND = '찾는 자랑 글이 없어요. 주소를 다시 확인해 주세요.';

interface PostRow {
  id: number;
  nickname: string;
  trade_status: 'available' | 'not_for_trade' | 'traded';
}

interface TradeRow {
  id: number;
  target_post_id: number;
  offer_post_id: number;
  requester_nickname: string;
  status: TradeStatus;
}

// 목록에서 보여 줄 아이템 정보 (받고 싶은 아이템 = target, 대신 줄 아이템 = offer)
const postJson = (alias: string, seriesAlias: string) => `json_build_object(
  'id', ${alias}.id, 'nickname', ${alias}.nickname, 'character_name', ${alias}.character_name,
  'rarity', ${alias}.rarity, 'trade_status', ${alias}.trade_status,
  'ip_name', ${seriesAlias}.ip_name, 'series_name', ${seriesAlias}.name)`;

const TRADE_SELECT = `
  SELECT t.id, t.target_post_id, t.offer_post_id, t.requester_nickname, t.status, t.created_at, t.updated_at,
         tp.nickname AS owner_nickname,
         ${postJson('tp', 'ts')} AS target,
         ${postJson('op', 'os')} AS offer
    FROM ${SCHEMA}.trade_requests t
    JOIN ${SCHEMA}.posts tp ON tp.id = t.target_post_id
    LEFT JOIN ${SCHEMA}.series ts ON ts.id = tp.series_id
    JOIN ${SCHEMA}.posts op ON op.id = t.offer_post_id
    LEFT JOIN ${SCHEMA}.series os ON os.id = op.series_id`;

/** 요청에 담긴 "지금 나는" 닉네임 확인 */
function actorNickname(value: unknown, field = 'nickname'): string {
  const nickname = asText(value);
  const errors: FieldErrors = {};
  if (!nickname) errors[field] = '화면 위 "지금 나는"에서 닉네임을 골라 주세요';
  else if (charLength(nickname) < 2 || charLength(nickname) > 12) errors[field] = '닉네임은 2~12자여야 해요';
  throwIfInvalid(errors);
  return nickname;
}

/** 본문의 아이템 번호 확인 (없거나 숫자가 아니면 쉬운 말로 안내) */
function postIdField(value: unknown, emptyMessage: string): number | null {
  const raw = typeof value === 'number' ? String(value) : asText(value);
  if (!raw) return null;
  const id = Number(raw);
  if (!/^\d+$/.test(raw) || id < 1 || id > 2_147_483_647) throw new NotFoundException(emptyMessage);
  return id;
}

@Injectable()
export class TradesService {
  constructor(private readonly db: DbService) {}

  /** 내 교환: 내가 보낸 신청 + 내 아이템에 들어온 신청 */
  async listFor(rawNickname: unknown) {
    const nickname = actorNickname(rawNickname);
    const order = `ORDER BY (t.status = 'pending') DESC, t.updated_at DESC, t.id DESC`;
    const [sent, received] = await Promise.all([
      this.db.query(`${TRADE_SELECT} WHERE t.requester_nickname = $1 ${order}`, [nickname]),
      this.db.query(`${TRADE_SELECT} WHERE tp.nickname = $1 ${order}`, [nickname]),
    ]);
    const pendingSent = sent.filter((trade) => trade.status === 'pending').length;
    return { nickname, sent, received, pending_sent_count: pendingSent, max_pending: MAX_PENDING_PER_PERSON };
  }

  /** 교환 신청 — 규칙 1~5를 모두 여기서 확인한다 */
  async create(body: Record<string, unknown>) {
    const errors: FieldErrors = {};
    const requester = asText(body.requester_nickname);
    if (!requester) errors.requester_nickname = '화면 위 "지금 나는"에서 닉네임을 골라 주세요';
    const targetId = postIdField(body.target_post_id, POST_NOT_FOUND);
    if (targetId === null) errors.target_post_id = '교환하고 싶은 아이템을 골라 주세요';
    const offerId = postIdField(body.offer_post_id, '고른 내 아이템을 찾을 수 없어요. 다시 골라 주세요.');
    if (offerId === null) errors.offer_post_id = '대신 줄 내 아이템을 하나 골라 주세요';
    throwIfInvalid(errors);
    actorNickname(requester, 'requester_nickname');

    const tradeId = await this.db.transaction(async (client) => {
      // 같은 사람의 신청은 한 번에 하나씩 처리한다 (동시에 눌러도 규칙 4를 넘지 못하게)
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`${SCHEMA}:trade:${requester}`]);
      const posts = await this.lockPosts(client, [targetId!, offerId!]);
      const target = posts.get(targetId!);
      if (!target) throw new NotFoundException(POST_NOT_FOUND);

      // 규칙 1: 내 아이템에는 신청할 수 없다
      if (target.nickname === requester) ruleBroken(1);
      // 규칙 3: 교환 완료·교환 안 함 아이템에는 신청할 수 없다
      if (target.trade_status !== 'available') ruleBroken(3);
      // 규칙 2: 같은 아이템에 대기 중인 신청을 또 걸 수 없다
      const [duplicate] = (
        await client.query(
          `SELECT id FROM ${SCHEMA}.trade_requests
            WHERE target_post_id = $1 AND requester_nickname = $2 AND status = 'pending'`,
          [targetId, requester],
        )
      ).rows;
      if (duplicate) ruleBroken(2);
      // 규칙 5: 줄 아이템은 내 것이고 교환 가능 상태여야 한다
      const offer = posts.get(offerId!);
      if (!offer || offer.nickname !== requester || offer.trade_status !== 'available' || offer.id === target.id) ruleBroken(5);
      // 규칙 4: 대기 중 신청은 동시에 3건까지
      const [{ count }] = (
        await client.query(
          `SELECT COUNT(*)::int AS count FROM ${SCHEMA}.trade_requests WHERE requester_nickname = $1 AND status = 'pending'`,
          [requester],
        )
      ).rows;
      if (count >= MAX_PENDING_PER_PERSON) ruleBroken(4);

      try {
        const { rows } = await client.query(
          `INSERT INTO ${SCHEMA}.trade_requests (target_post_id, offer_post_id, requester_nickname)
           VALUES ($1, $2, $3) RETURNING id`,
          [targetId, offerId, requester],
        );
        return rows[0].id as number;
      } catch (error) {
        // DB의 고유 인덱스가 규칙 2를 한 번 더 막아 준 경우
        if ((error as { code?: string }).code === '23505') ruleBroken(2);
        throw error;
      }
    });
    return this.findOne(tradeId);
  }

  /** 취소: 신청한 본인만, 대기 중일 때만 */
  async cancel(id: number, body: Record<string, unknown>) {
    const nickname = actorNickname(body.nickname);
    await this.db.transaction(async (client) => {
      const trade = await this.lockTrade(client, id);
      if (trade.requester_nickname !== nickname) throw new ForbiddenException('내가 보낸 신청만 취소할 수 있어요.');
      this.assertPending(trade, '취소');
      await this.setStatus(client, [trade.id], 'canceled');
    });
    return this.findOne(id);
  }

  /** 거절: 아이템 주인만, 대기 중일 때만 */
  async reject(id: number, body: Record<string, unknown>) {
    const nickname = actorNickname(body.nickname);
    await this.db.transaction(async (client) => {
      const trade = await this.lockTrade(client, id);
      await this.assertOwner(client, trade, nickname, '거절');
      this.assertPending(trade, '거절');
      await this.setStatus(client, [trade.id], 'rejected');
    });
    return this.findOne(id);
  }

  /** 수락: 아이템 주인만. 두 아이템을 교환 완료로 바꾸고, 두 아이템에 걸린 다른 대기 신청은 자동 거절 */
  async accept(id: number, body: Record<string, unknown>) {
    const nickname = actorNickname(body.nickname);
    const autoRejected = await this.db.transaction(async (client) => {
      // 아이템을 먼저 잠그고(번호 순서) 신청을 잠근다 → 두 수락이 동시에 와도 서로 기다리다 멈추지 않는다
      const [peek] = (
        await client.query<TradeRow>(`SELECT target_post_id, offer_post_id FROM ${SCHEMA}.trade_requests WHERE id = $1`, [id])
      ).rows;
      if (!peek) throw new NotFoundException(TRADE_NOT_FOUND);
      const posts = await this.lockPosts(client, [peek.target_post_id, peek.offer_post_id]);
      const trade = await this.lockTrade(client, id);

      const target = posts.get(trade.target_post_id)!;
      const offer = posts.get(trade.offer_post_id)!;
      if (target.nickname !== nickname) throw new ForbiddenException('내 아이템에 들어온 신청만 수락할 수 있어요.');
      this.assertPending(trade, '수락');
      if (target.trade_status !== 'available' || offer.trade_status !== 'available' || offer.nickname !== trade.requester_nickname) {
        throw new ConflictException('두 아이템 중 하나가 이미 교환할 수 없는 상태라 수락할 수 없어요.');
      }

      await this.setStatus(client, [trade.id], 'accepted');
      await client.query(`UPDATE ${SCHEMA}.posts SET trade_status = 'traded' WHERE id = ANY($1)`, [[target.id, offer.id]]);
      const { rows } = await client.query<{ id: number }>(
        `UPDATE ${SCHEMA}.trade_requests
            SET status = 'rejected', updated_at = now()
          WHERE status = 'pending' AND id <> $1
            AND (target_post_id = ANY($2) OR offer_post_id = ANY($2))
          RETURNING id`,
        [trade.id, [target.id, offer.id]],
      );
      return rows.length;
    });
    return { ...(await this.findOne(id)), auto_rejected_count: autoRejected };
  }

  private async findOne(id: number) {
    const [trade] = await this.db.query(`${TRADE_SELECT} WHERE t.id = $1`, [id]);
    if (!trade) throw new NotFoundException(TRADE_NOT_FOUND);
    return trade;
  }

  /** 아이템들을 번호 순서로 잠그고 돌려준다 (없는 번호는 빠진다) */
  private async lockPosts(client: PoolClient, ids: number[]) {
    const { rows } = await client.query<PostRow>(
      `SELECT id, nickname, trade_status FROM ${SCHEMA}.posts WHERE id = ANY($1) ORDER BY id FOR UPDATE`,
      [ids],
    );
    return new Map(rows.map((row) => [row.id, row]));
  }

  private async lockTrade(client: PoolClient, id: number) {
    const [trade] = (
      await client.query<TradeRow>(
        `SELECT id, target_post_id, offer_post_id, requester_nickname, status
           FROM ${SCHEMA}.trade_requests WHERE id = $1 FOR UPDATE`,
        [id],
      )
    ).rows;
    if (!trade) throw new NotFoundException(TRADE_NOT_FOUND);
    return trade;
  }

  private async assertOwner(client: PoolClient, trade: TradeRow, nickname: string, action: string) {
    const [target] = (
      await client.query<PostRow>(`SELECT id, nickname, trade_status FROM ${SCHEMA}.posts WHERE id = $1`, [trade.target_post_id])
    ).rows;
    if (target?.nickname !== nickname) throw new ForbiddenException(`내 아이템에 들어온 신청만 ${action}할 수 있어요.`);
  }

  private assertPending(trade: TradeRow, action: string) {
    if (trade.status !== 'pending') {
      throw new ConflictException(`대기 중인 신청만 ${action}할 수 있어요. 이 신청은 이미 ${STATUS_DONE[trade.status]}.`);
    }
  }

  private setStatus(client: PoolClient, ids: number[], status: TradeStatus) {
    return client.query(`UPDATE ${SCHEMA}.trade_requests SET status = $2, updated_at = now() WHERE id = ANY($1)`, [ids, status]);
  }
}
