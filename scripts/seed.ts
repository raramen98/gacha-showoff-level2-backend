import 'dotenv/config';
import { createPool, SCHEMA } from '../src/db/pool';
import { reseed } from '../src/db/seed';

// 가상 데이터는 src/db/seed.ts에 있다 — 현황 화면의 "가상 데이터 다시 채우기" 버튼(POST /admin/reseed)과 같은 코드
async function main() {
  const reset = process.argv.includes('--reset');
  const pool = createPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM ${SCHEMA}.series`);
    if (!reset && rows[0].count > 0) {
      console.log('ℹ️  이미 데이터가 있어서 가상 데이터를 넣지 않았어요. (처음부터 다시 넣으려면 npm run db:reset)');
      await client.query('ROLLBACK');
      return;
    }
    const counts = await reseed(client);
    await client.query('COMMIT');
    console.log(`✅ ${SCHEMA}에 가상 데이터를 넣었어요: 시리즈 ${counts.series}개, 자랑 글 ${counts.posts}개, 교환 신청 ${counts.trades}건`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('❌ 가상 데이터를 넣지 못했어요:', error.message);
  process.exit(1);
});
