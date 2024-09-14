import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { config } from '../config';

@Module({
  imports: [MongooseModule.forRoot(config.database.uri), UsersModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
