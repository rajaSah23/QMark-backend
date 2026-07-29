"use strict"

/**
 * One-shot, idempotent migration: moves the legacy `MCQ.bookmark` boolean into
 * per-user UserQuestionState rows, then removes the field from all questions.
 *
 * Safe to re-run. Never deletes questions or user state.
 *
 * Standalone usage: node scripts/migrate-bookmarks.js
 */

const mongoose = require("mongoose")
const UserQuestionState = require("../modules/mcq/userQuestionStateModel")

const migrateBookmarks = async () => {
  const mcqs = mongoose.connection.collection("mcqs")

  // Read raw: `bookmark` is gone from the schema, so the model cannot see it.
  const bookmarked = await mcqs.find({ bookmark: true }).toArray()

  let migrated = 0
  for (const mcq of bookmarked) {
    if (!mcq.user) continue
    await UserQuestionState.updateOne(
      { user: mcq.user, question: mcq._id },
      { $set: { bookmarked: true } },
      { upsert: true }
    )
    migrated += 1
  }

  const result = await mcqs.updateMany(
    { bookmark: { $exists: true } },
    { $unset: { bookmark: "" } }
  )

  return { migrated, unset: result.modifiedCount }
}

const runStandalone = async () => {
  require("dotenv").config()
  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set. Aborting.")
    process.exit(1)
  }

  await mongoose.connect(process.env.MONGODB_URI)
  console.log("Connected. Starting bookmark migration...")

  const before = await mongoose.connection
    .collection("mcqs")
    .countDocuments({ bookmark: true })
  console.log(`Questions with bookmark:true before: ${before}`)

  const { migrated, unset } = await migrateBookmarks()

  console.log(`UserQuestionState rows upserted: ${migrated}`)
  console.log(`Questions with bookmark field removed: ${unset}`)
  console.log("Migration complete.")

  await mongoose.disconnect()
}

if (require.main === module) {
  runStandalone().catch((error) => {
    console.error("Migration failed:", error)
    process.exit(1)
  })
}

module.exports = { migrateBookmarks }
