const mongoose = require('mongoose');

const MCQSchema = new mongoose.Schema({
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
    type: String,
    default:"other"
  },
  topic: {
    type: String,
    default:"other"
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