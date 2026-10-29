import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

/**
 * 우리가 직접 만든 한국어 안내는 그대로 두고,
 * NestJS/Express가 기본으로 내보내는 영어 오류만 쉬운 한국어로 바꾼다.
 */
@Catch()
export class KoreanExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : (body as { message?: unknown }).message;

      if (typeof message === 'string' && /^Cannot (GET|POST|PUT|PATCH|DELETE)/.test(message)) {
        return response.status(status).json({ statusCode: status, message: '없는 주소예요. 주소를 다시 확인해 주세요.' });
      }
      if (status === HttpStatus.BAD_REQUEST && typeof message === 'string' && /JSON|Unexpected/i.test(message)) {
        return response.status(status).json({ statusCode: status, message: '보낸 내용을 읽을 수 없어요. 형식을 확인해 주세요.' });
      }
      if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
        const message = '사진은 5MB 이하로 올려 주세요';
        return response.status(status).json({ statusCode: status, message, errors: { image: message } });
      }
      if (status === HttpStatus.BAD_REQUEST && typeof message === 'string' && /^Unexpected field|^Too many/.test(message)) {
        const message = '사진은 한 장만 올려 주세요';
        return response.status(status).json({ statusCode: status, message, errors: { image: message } });
      }
      return response.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
    }

    console.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: '서버에 문제가 생겼어요. 잠시 후 다시 해 주세요.',
    });
  }
}
