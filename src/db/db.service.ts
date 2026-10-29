import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { createPool } from './pool';

@Injectable()
export class DbService implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool = createPool();

  /** 서버가 켜질 때 미리 연결해 둬서, 첫 요청이 느리거나 실패하지 않게 한다 (기다리지는 않음) */
  onModuleInit() {
    this.pool
      .query('SELECT 1')
      .then(() => console.log('🔌 DB에 미리 연결해 뒀어요.'))
      .catch((error) => console.warn('⚠️ DB에 미리 연결하지 못했어요:', error.message));
  }

  async query<T extends QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query<T>(text, params);
    return result.rows;
  }

  /** 여러 쿼리를 한 묶음으로 실행한다. 중간에 실패하면 모두 되돌린다 */
  async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy() {
    await this.pool.end();
  }
}
