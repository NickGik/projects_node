import mongoose, { Model } from 'mongoose';
import { faker } from '@faker-js/faker';

import { User, UserSchema } from './schemas/user.schema';

const connectToDatabase = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/users_db');
    console.log('Connected to MongoDB');

    const User: Model<User> = mongoose.model('User', UserSchema);
    const batchSize = 1000; // Вставляем по 1000 пользователей за раз
    const totalUsers = 1000000;

    for (let i = 0; i < totalUsers; i += batchSize) {
      const bulkOperations = [];
      for (let j = 0; j < batchSize; j++) {
        const user = {
          firstName: faker.person.firstName(),
          lastName: faker.person.lastName(),
          age: faker.number.int({ min: 18, max: 65 }),
          gender: faker.helpers.arrayElement(['Male', 'Female']),
          problems: faker.datatype.boolean(),
        };
        bulkOperations.push({ insertOne: { document: user } });
      }

      await User.bulkWrite(bulkOperations);
      console.log(`Successfully inserted ${i + batchSize} users!`);

      await new Promise((resolve) => setTimeout(resolve, 100)); // Пауза в 100 мс
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error inserting users or disconnecting:', error);
  }
};

connectToDatabase();
