import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema()
export class User {
  @Prop({ type: String, required: true })
  firstName!: string;

  @Prop({ type: String, required: true })
  lastName!: string;

  @Prop({ type: Number, required: true })
  age!: number;

  @Prop({ type: String, required: true })
  gender!: string;

  @Prop({ type: Boolean, default: true })
  problems: boolean = true;
}

export const UserSchema = SchemaFactory.createForClass(User);
