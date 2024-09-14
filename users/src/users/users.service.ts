import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async updateProblemsForUsers(userIds: string[]): Promise<number> {
    const result = await this.userModel.updateMany({ _id: { $in: userIds } }, { problems: false });
    return result.modifiedCount;
  }

  async countUsersWithProblems(): Promise<number> {
    const result = await this.userModel.aggregate([
      { $match: { problems: true } },
      { $count: 'count' },
    ]);
    return result.length > 0 ? result[0].count : 0;
  }
}
