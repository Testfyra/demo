import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
  console.log(statement)
  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  @Get('api/overview')
  getOverview() {
    return this.appService.getOverview();
  },
}
