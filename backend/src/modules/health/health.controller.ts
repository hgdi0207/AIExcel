import { Controller, Get } from '@nestjs/common';
import { Public } from '../../shared/public.decorator';

@Controller('health')
export class HealthController {
  @Get()
  @Public()
  check() {
    return {
      success: true,
      data: {
        status: 'ok',
      },
    };
  }
}
