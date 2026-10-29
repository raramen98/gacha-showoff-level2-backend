import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createPool } from '../src/db/pool';

async function main() {
  const pool = createPool();
  try {
    await pool.query(readFileSync(join(__dirname, 'schema.sql'), 'utf8'));
    console.log('✅ gacha_l2 스키마와 테이블(series, posts, trade_requests)을 준비했어요.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('❌ 테이블을 만들지 못했어요:', error.message);
  process.exit(1);
});
