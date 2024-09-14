import { Controller, Post, Body, Get } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('update-problems')
  async updateProblems(@Body() userIds: { userIds: string[] }): Promise<number> {
    return this.usersService.updateProblemsForUsers(userIds.userIds);
  }

  @Get('count-problems')
  async countUsersWithProblems(): Promise<number> {
    return this.usersService.countUsersWithProblems();
  }
}
