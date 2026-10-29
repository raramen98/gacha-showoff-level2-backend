import type { PoolClient } from 'pg';
import { SCHEMA } from './pool';

/** 가상 사용자 8명 — 화면 위 "지금 나는: [닉네임 ▼]"에서 고른다 */
export const USERS = ['시나모롤러버', '가챠요정', '오늘도꽝', '캡슐수집가', '주말가챠러', '시크릿헌터', '피카덕후', '뽑기장인'];

// 기획서 10. 가상 데이터 — 시리즈 이름·가격은 가상, 캐릭터 이름은 실제
const SERIES: [ipName: string, name: string, price: number, releaseDate: string][] = [
  ['산리오', '산리오 캐릭터즈 말랑 마스코트 Vol.1', 4000, '2026-06-15'],
  ['산리오', '산리오 파자마 파티 키링', 5000, '2026-09-10'],
  ['포켓몬', '포켓몬 미니 피규어 컬렉션 Vol.1', 5000, '2026-09-01'],
  ['포켓몬', '포켓몬 낮잠 시간 아크릴 스탠드', 3000, '2026-07-20'],
  ['주술회전', '주술회전 데포르메 캔뱃지', 4000, '2026-05-30'],
  ['주술회전', '주술회전 앉은 자세 미니 피규어', 6000, '2026-08-25'],
  ['나루토', '나루토 닌자 학교 러버 스트랩', 4000, '2026-04-18'],
  ['나루토', '나루토 인술 포즈 피규어', 6000, '2026-08-08'],
  ['진격의 거인', '진격의 거인 조사병단 아크릴 키링', 5000, '2026-06-01'],
  ['진격의 거인', '진격의 거인 미니 흉상 컬렉션', 7000, '2026-09-20'],
  ['디즈니', '디즈니 프렌즈 말랑 쿠션 키링', 5000, '2026-07-05'],
  ['디즈니', '디즈니 티타임 미니어처', 6000, '2026-10-01'],
];

// [시리즈 순서(0부터), 닉네임, 캐릭터, 레어도, 업로드 날짜, 한마디] — 시리즈마다 시크릿 1~2개
// 아래 교환 신청(TRADES)은 이 목록의 순서(0부터)로 아이템을 가리킨다
// 가상 데이터에는 사진이 없어서, 화면에서는 작품별 색과 이모지로 대신 보여 준다
const POSTS: [number, string, string, 'common' | 'rare' | 'secret', string, string][] = [
  [0, '시나모롤러버', '시나모롤', 'secret', '2026-06-21', '다섯 번 만에 시크릿 시나모롤! 손이 떨렸어요'],
  [0, '가챠요정', '쿠로미', 'rare', '2026-06-28', '쿠로미 나왔다 💜 가방에 바로 달았어요'],
  [0, '오늘도꽝', '폼폼푸린', 'common', '2026-07-03', '푸린도 귀엽긴 한데 마이멜로디가 갖고 싶었어요'],
  [0, '캡슐수집가', '헬로키티', 'common', '2026-07-19', '키티 두 번째… 교환하실 분 구해요'],
  [1, '시나모롤러버', '마이멜로디', 'rare', '2026-09-14', '파자마 입은 멜로디 너무 귀여워요'],
  [1, '주말가챠러', '쿠로미', 'common', '2026-09-21', '첫 판에 쿠로미! 운 좋은 주말'],
  [1, '시크릿헌터', '헬로키티', 'secret', '2026-10-05', '시크릿 키티 잠옷 버전, 12번 돌렸어요'],
  [1, '피카덕후', '시나모롤', 'common', '2026-10-12', '포켓몬 하러 갔다가 옆에서 한 번 돌려 봤어요'],
  [2, '피카덕후', '피카츄', 'secret', '2026-09-03', '3번 만에 시크릿! 반짝이 피카츄예요'],
  [2, '뽑기장인', '이브이', 'rare', '2026-09-07', '이브이 꼬리 디테일이 정말 좋아요'],
  [2, '오늘도꽝', '꼬부기', 'common', '2026-09-13', '꼬부기 세 번째… 그래도 귀여우니까'],
  [2, '캡슐수집가', '잠만보', 'common', '2026-09-27', '잠만보 크기가 생각보다 커요'],
  [2, '가챠요정', '뮤', 'rare', '2026-10-18', '뮤 나와서 소리 질렀어요'],
  [3, '피카덕후', '잠만보', 'rare', '2026-07-22', '자는 잠만보 = 나'],
  [3, '주말가챠러', '피카츄', 'common', '2026-08-02', '피카츄 기본 버전, 책상에 세워 뒀어요'],
  [3, '시크릿헌터', '뮤', 'secret', '2026-08-16', '시크릿 뮤 드디어! 20번 넘게 돌렸어요'],
  [3, '뽑기장인', '이브이', 'common', '2026-09-06', ''],
  [4, '가챠요정', '고죠 사토루', 'secret', '2026-06-06', '시크릿 고죠 눈가리개 벗은 버전!!'],
  [4, '뽑기장인', '이타도리 유지', 'common', '2026-06-14', '유지 웃는 얼굴 보고 힘 나요'],
  [4, '오늘도꽝', '후시구로 메구미', 'rare', '2026-06-20', '메구미 레어는 은박이에요'],
  [4, '시크릿헌터', '쿠기사키 노바라', 'common', '2026-07-11', '노바라 언니 멋있어요'],
  [5, '캡슐수집가', '이타도리 유지', 'common', '2026-08-30', '앉아 있는 유지 너무 작고 소중해'],
  [5, '가챠요정', '고죠 사토루', 'rare', '2026-09-06', '고죠 레어 버전, 선글라스 썼어요'],
  [5, '시크릿헌터', '후시구로 메구미', 'secret', '2026-09-19', '시크릿 메구미 + 옥견 세트예요'],
  [5, '주말가챠러', '쿠기사키 노바라', 'secret', '2026-10-10', '이 시리즈 시크릿이 두 종류래요, 노바라 버전 뽑았어요'],
  [5, '오늘도꽝', '이타도리 유지', 'common', '2026-10-24', '유지만 세 개째…'],
  [6, '뽑기장인', '나루토', 'common', '2026-04-25', '라면 먹는 나루토 ㅋㅋ'],
  [6, '주말가챠러', '사스케', 'rare', '2026-05-09', '사스케 레어 나왔어요, 차가운 표정이 포인트'],
  [6, '시크릿헌터', '이타치', 'secret', '2026-05-23', '시크릿 이타치 까마귀 버전 🐦'],
  [6, '피카덕후', '카카시', 'common', '2026-06-13', '카카시 선생님 책 읽는 포즈'],
  [7, '뽑기장인', '나루토', 'rare', '2026-08-10', '나선환 이펙트 파츠까지 들어 있어요'],
  [7, '캡슐수집가', '카카시', 'common', '2026-08-24', '카카시 치도리 포즈'],
  [7, '오늘도꽝', '사스케', 'common', '2026-09-14', ''],
  [7, '시크릿헌터', '카카시', 'secret', '2026-10-03', '시크릿 카카시 맨얼굴!! 진짜 나와요'],
  [8, '주말가챠러', '리바이', 'secret', '2026-06-07', '시크릿 리바이 청소 버전 🧹'],
  [8, '가챠요정', '미카사', 'rare', '2026-06-21', '미카사 목도리 색이 예뻐요'],
  [8, '오늘도꽝', '아르민', 'common', '2026-07-05', ''],
  [8, '뽑기장인', '에렌', 'common', '2026-07-26', '에렌 조사병단 망토 버전'],
  [9, '시크릿헌터', '에렌', 'secret', '2026-09-27', '시크릿 거인화 에렌, 박스째 살 뻔했어요'],
  [9, '주말가챠러', '리바이', 'rare', '2026-10-04', '리바이 병장님 흉상 레어'],
  [9, '캡슐수집가', '아르민', 'common', '2026-10-11', '아르민 표정이 너무 순해요'],
  [9, '오늘도꽝', '미카사', 'common', '2026-10-25', '미카사 두 번째'],
  [10, '캡슐수집가', '스티치', 'secret', '2026-07-12', '시크릿 스티치 하와이 셔츠 버전!'],
  [10, '시나모롤러버', '곰돌이 푸', 'common', '2026-07-19', '푸가 말랑말랑해서 계속 만지게 돼요'],
  [10, '피카덕후', '미키 마우스', 'rare', '2026-08-09', ''],
  [10, '가챠요정', '마리', 'common', '2026-08-23', '마리 리본 색이 진해서 예뻐요'],
  [11, '시나모롤러버', '마리', 'rare', '2026-10-04', '찻잔 든 마리 너무 우아해요'],
  [11, '주말가챠러', '곰돌이 푸', 'secret', '2026-10-11', '시크릿 꿀단지 푸 🍯 첫 판에 나왔어요'],
  [11, '뽑기장인', '미키 마우스', 'common', '2026-10-18', '미키가 티팟을 들고 있어요'],
  [11, '오늘도꽝', '스티치', 'common', '2026-10-26', '스티치는 레어인 줄 알았는데 일반이네요'],
];

// "오늘 올라온 자랑 글"이 0이 되지 않도록, 다시 채울 때마다 등록 시각을 오늘(한국 시간)로 넣는 글
// [시리즈 순서, 닉네임, 캐릭터, 레어도, 몇 분 전에 올렸는지, 한마디] — POSTS 뒤에 이어서 50번부터
const TODAY_POSTS: [number, string, string, 'common' | 'rare' | 'secret', number, string][] = [
  [0, '오늘도꽝', '쿠로미', 'common', 25, '쿠로미 또 나왔어요… 마이멜로디랑 바꾸실 분!'],
  [2, '시나모롤러버', '피카츄', 'common', 50, '친구 따라 처음 돌려 본 포켓몬 가챠'],
  [5, '피카덕후', '고죠 사토루', 'common', 80, '고죠 일반 버전도 귀엽네요'],
  [8, '캡슐수집가', '리바이', 'common', 120, '리바이 키링 두 개째라 교환 구해요'],
  [11, '가챠요정', '스티치', 'rare', 170, '티타임 스티치 레어! 컵 디테일 최고'],
  [7, '주말가챠러', '이타치', 'rare', 230, '오늘 첫 판에 이타치 레어 🐦'],
];

// 교환하지 않겠다고 정해 둔 아이템 (POSTS 순서) — 아끼는 시크릿들
const NOT_FOR_TRADE = new Set([0, 15, 28, 42]);

type TradeStatus = 'pending' | 'accepted' | 'rejected' | 'canceled';
// [받고 싶은 아이템, 대신 줄 아이템, 신청한 사람, 상태, 며칠 전에 신청했는지]
// 신청한 사람 = 줄 아이템의 주인, 받고 싶은 아이템은 다른 사람 것 (규칙 1, 5)
const TRADES: [target: number, offer: number, requester: string, status: TradeStatus, daysAgo: number][] = [
  // 오늘도꽝은 대기 중 신청 3건 → 한 건 더 신청하면 규칙 4로 막힌다
  [1, 2, '오늘도꽝', 'pending', 1],
  [22, 25, '오늘도꽝', 'pending', 2],
  [27, 32, '오늘도꽝', 'pending', 3],
  [12, 43, '시나모롤러버', 'pending', 1],
  [9, 13, '피카덕후', 'pending', 2],
  [22, 21, '캡슐수집가', 'pending', 4], // 가챠요정의 고죠(22)에 신청 2건 → 하나를 수락하면 다른 하나는 자동 거절
  [46, 48, '뽑기장인', 'pending', 0],
  // 수락된 교환 — 두 아이템 모두 교환 완료
  [35, 14, '주말가챠러', 'accepted', 9],
  [18, 20, '시크릿헌터', 'accepted', 12],
  // 거절 (35번은 위 교환이 수락되면서 자동 거절된 것)
  [8, 10, '오늘도꽝', 'rejected', 15],
  [35, 40, '캡슐수집가', 'rejected', 10],
  [6, 45, '가챠요정', 'rejected', 7],
  // 신청한 사람이 스스로 취소
  [30, 36, '오늘도꽝', 'canceled', 6],
  [34, 44, '피카덕후', 'canceled', 5],
  [11, 4, '시나모롤러버', 'canceled', 8],
];

/**
 * gacha_l2의 데이터만 모두 지우고 가상 데이터를 다시 채운다.
 * 트랜잭션은 부르는 쪽에서 연다 (실패하면 지운 것까지 모두 되돌린다).
 */
export async function reseed(client: PoolClient) {
  await client.query(`TRUNCATE ${SCHEMA}.trade_requests, ${SCHEMA}.posts, ${SCHEMA}.series RESTART IDENTITY CASCADE`);

  const seriesIds: number[] = [];
  for (const [ipName, name, price, releaseDate] of SERIES) {
    const result = await client.query(
      `INSERT INTO ${SCHEMA}.series (ip_name, name, price, release_date, created_at)
       VALUES ($1, $2, $3, $4, ($4::date + time '10:00') AT TIME ZONE 'Asia/Seoul')
       RETURNING id`,
      [ipName, name, price, releaseDate],
    );
    seriesIds.push(result.rows[0].id);
  }

  const postIds: number[] = [];
  for (const [index, [seriesIndex, nickname, characterName, rarity, uploadedOn, comment]] of POSTS.entries()) {
    // 업로드 시각은 그날 저녁(한국 시간)으로 맞춘다
    const result = await client.query(
      `INSERT INTO ${SCHEMA}.posts (series_id, nickname, character_name, rarity, comment, trade_status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, ($7::date + time '20:00' + random() * interval '2 hours') AT TIME ZONE 'Asia/Seoul')
       RETURNING id`,
      [seriesIds[seriesIndex], nickname, characterName, rarity, comment, NOT_FOR_TRADE.has(index) ? 'not_for_trade' : 'available', uploadedOn],
    );
    postIds.push(result.rows[0].id);
  }

  for (const [seriesIndex, nickname, characterName, rarity, minutesAgo, comment] of TODAY_POSTS) {
    // 몇 분 전으로 넣되, 한국 시간 오늘 0시보다 앞서지는 않게 한다
    await client.query(
      `INSERT INTO ${SCHEMA}.posts (series_id, nickname, character_name, rarity, comment, created_at)
       VALUES ($1, $2, $3, $4, $5,
               GREATEST(now() - $6::int * interval '1 minute',
                        date_trunc('day', now() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul'))`,
      [seriesIds[seriesIndex], nickname, characterName, rarity, comment, minutesAgo],
    );
  }

  for (const [target, offer, requester, status, daysAgo] of TRADES) {
    // 대기 중이 아닌 신청은 하루 뒤에 처리된 것으로 한다
    await client.query(
      `INSERT INTO ${SCHEMA}.trade_requests (target_post_id, offer_post_id, requester_nickname, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4::text, now() - $5::int * interval '1 day' - interval '3 hours',
               CASE WHEN $4::text = 'pending' THEN now() - $5::int * interval '1 day' - interval '3 hours'
                    ELSE LEAST(now(), now() - $5::int * interval '1 day' + interval '21 hours') END)`,
      [postIds[target], postIds[offer], requester, status, daysAgo],
    );
    if (status === 'accepted') {
      await client.query(`UPDATE ${SCHEMA}.posts SET trade_status = 'traded' WHERE id = ANY($1)`, [[postIds[target], postIds[offer]]]);
    }
  }

  return { series: SERIES.length, posts: POSTS.length + TODAY_POSTS.length, trades: TRADES.length };
}
