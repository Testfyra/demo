import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.serice';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }
}
