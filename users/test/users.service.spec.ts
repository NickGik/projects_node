import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../src/users/users.service';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../src/users/schemas/user.schema';

describe('UsersService', () => {
  let service: UsersService;
  let userModel: Model<UserDocument>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: {
            updateMany: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
            aggregate: jest.fn().mockResolvedValue([{ count: 1500 }]),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userModel = module.get<Model<UserDocument>>(getModelToken(User.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should update problems for users', async () => {
    const userIds = ['640e61c21377e60079c71628', '640e61c21377e60079c71629'];

    const result = await service.updateProblemsForUsers(userIds);
    expect(result).toBe(2);

    expect(userModel.updateMany).toHaveBeenCalledWith(
      { _id: { $in: userIds } },
      { problems: false },
    );
  });

  it('should count users with problems', async () => {
    const result = await service.countUsersWithProblems();
    expect(result).toBe(1500);

    expect(userModel.aggregate).toHaveBeenCalled();
  });
});
