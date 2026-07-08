import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
console.log(nothing);
console.log(there);
@Module({
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
