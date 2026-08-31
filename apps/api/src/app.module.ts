import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.fix';


@Module({
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
