import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.s
  ervice';
console.log(fixes)
@Module({
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
