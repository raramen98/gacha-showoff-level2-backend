import { BadRequestException, NotFoundException } from '@nestjs/common';

/** 칸 이름 → 쉬운 한국어 안내 문장 */
export type FieldErrors = Record<string, string>;

export const RARITIES = ['common', 'rare', 'secret'] as const;
export type Rarity = (typeof RARITIES)[number];

/** 이모지도 한 글자로 세기 */
export const charLength = (value: string) => [...value].length;

export const asText = (value: unknown) => (typeof value === 'string' ? value.trim() : '');


/** "2026-10-20"처럼 실제로 있는 날짜인지 확인 (2026-02-30 같은 날짜는 거절) */
export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** 틀린 칸이 하나라도 있으면 400 응답으로 이유를 돌려준다 */
export function throwIfInvalid(errors: FieldErrors) {
  const messages = Object.values(errors);
  if (messages.length > 0) {
    throw new BadRequestException({
      statusCode: 400,
      message: messages[0],
      errors,
    });
  }
}

/** 주소의 :id가 올바른 번호인지 확인. 아니면 "찾을 수 없어요" */
export function parseId(raw: string, notFoundMessage: string): number {
  const id = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(id) || id < 1 || id > 2_147_483_647) {
    throw new NotFoundException(notFoundMessage);
  }
  return id;
}

/** 올릴 수 있는 사진 — multer가 넘겨 주는 파일 중 필요한 부분만 */
export interface UploadedImage {
  buffer: Buffer;
  size: number;
  mimetype: string;
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** 파일 앞부분을 보고 진짜 사진인지 확인한다 (확장자만 바꾼 파일 거절) */
export function detectImageType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png';
  if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) return 'image/gif';
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP')
    return 'image/webp';
  return null;
}
