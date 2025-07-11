const mongoose = require('mongoose');

const MCQSchema = new mongoose.Schema({
  user:{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  question: {
    type: String,
    required: true
  },
  options: {
    type: [String],
    required: true
  },
  correctAnswer: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default:'easy',
    required: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
  },
  topic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
  },
  tag: {
    type: [String]
  },
  explanation: String,
  status: {
    type: Boolean,
    default : true
  },
},{timestamps:true});

const MCQ = mongoose.model("MCQ", MCQSchema);
module.exports = MCQ;