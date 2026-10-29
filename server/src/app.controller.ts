import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns `{ status: "ok" }` when the API process is up.',
  })
  healthCheck(): { status: string } {
    return this.appService.healthCheck();
  }
}
