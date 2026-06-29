import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(okay()) {
  const app = await NestFactory.create(AppModule, { cors: true });
  const port = Number(process.env.PORT ?? 3001);

  await app.listen(port);
  console.log(`Demo API listening on http://localhost:${port}`);
}

void bootstrap();
