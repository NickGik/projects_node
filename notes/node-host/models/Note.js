const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NoteSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // Добавлено required: true
  tags: [{ type: Schema.Types.ObjectId, ref: 'Tag' }],
  archived: { type: Boolean, default: false },
});

// Добавляем индексы для author и tags
NoteSchema.index({ author: 1 });
NoteSchema.index({ tags: 1 });

const Note = mongoose.model('Note', NoteSchema);

module.exports = Note;
