import { Pool, types } from 'pg';

// DATE 칸을 JS Date로 바꾸지 않고 "2026-10-20" 문자열 그대로 받기 (시간대 때문에 하루 밀리는 문제 방지)
types.setTypeParser(1082, (value) => value);
// COUNT(*) 결과(bigint)를 숫자로 받기
types.setTypeParser(20, (value) => Number(value));

export const SCHEMA = 'gacha_l2';

export function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL이 비어 있어요. backend/.env 파일을 확인해 주세요.');
  }
  const pool = new Pool({
    connectionString,
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    max: 5,
    // DB가 멀리(미국) 있어서 새 연결에 10초 넘게 걸릴 때가 있다 → 넉넉히 기다린다
    connectionTimeoutMillis: 30_000,
    // 연결 하나는 닫지 않고 남겨 둬서, 한동안 안 쓰다가 와도 새로 연결하지 않게 한다
    min: 1,
    idleTimeoutMillis: 30_000,
    // 쉬고 있는 연결이 중간에 끊기지 않도록 주기적으로 신호를 보낸다
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
  // 쉬고 있던 연결이 DB 쪽에서 끊겨도 서버가 꺼지지 않게 한다 (다음 요청 때 새로 연결)
  pool.on('error', (error) => console.warn('⚠️ 쉬고 있던 DB 연결이 끊겼어요:', error.message));
  return pool;
}
