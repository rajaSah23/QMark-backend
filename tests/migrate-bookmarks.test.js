"use strict"

const mongoose = require("mongoose")
const UserQuestionState = require("../modules/mcq/userQuestionStateModel")
const { migrateBookmarks } = require("../scripts/migrate-bookmarks")
const { createUser, createQuestion } = require("./helpers/factories")

/** Writes a legacy bookmark value directly, bypassing the current schema. */
const setLegacyBookmark = async (questionId, value) => {
  await mongoose.connection
    .collection("mcqs")
    .updateOne({ _id: questionId }, { $set: { bookmark: value } })
}

describe("bookmark migration", () => {
  it("moves legacy bookmarks into per-user state", async () => {
    const { user } = await createUser()
    const bookmarked = await createQuestion(user._id, { question: "Keep?" })
    const plain = await createQuestion(user._id, { question: "Plain?" })
    await setLegacyBookmark(bookmarked._id, true)
    await setLegacyBookmark(plain._id, false)

    const { migrated } = await migrateBookmarks()

    expect(migrated).toBe(1)
    const rows = await UserQuestionState.find({})
    expect(rows).toHaveLength(1)
    expect(rows[0].question.toString()).toBe(bookmarked._id.toString())
    expect(rows[0].user.toString()).toBe(user._id.toString())
    expect(rows[0].bookmarked).toBe(true)
  })

  it("removes the bookmark field from every question", async () => {
    const { user } = await createUser()
    const bookmarked = await createQuestion(user._id)
    const plain = await createQuestion(user._id)
    await setLegacyBookmark(bookmarked._id, true)
    await setLegacyBookmark(plain._id, false)

    await migrateBookmarks()

    const raws = await mongoose.connection
      .collection("mcqs")
      .find({})
      .toArray()
    expect(raws).toHaveLength(2)
    for (const raw of raws) {
      expect(raw.bookmark).toBeUndefined()
    }
  })

  it("is idempotent — running twice yields the same state", async () => {
    const { user } = await createUser()
    const question = await createQuestion(user._id)
    await setLegacyBookmark(question._id, true)

    const first = await migrateBookmarks()
    const second = await migrateBookmarks()

    expect(first.migrated).toBe(1)
    expect(second.migrated).toBe(0)

    const rows = await UserQuestionState.find({})
    expect(rows).toHaveLength(1)
    expect(rows[0].bookmarked).toBe(true)
  })

  it("does not clobber a bookmark the user changed post-migration", async () => {
    const { user } = await createUser()
    const question = await createQuestion(user._id)
    await setLegacyBookmark(question._id, true)

    await migrateBookmarks()
    // User then unbookmarks it.
    await UserQuestionState.updateOne(
      { user: user._id, question: question._id },
      { $set: { bookmarked: false } }
    )
    // Re-running must not resurrect the bookmark: the legacy field is gone.
    await migrateBookmarks()

    const row = await UserQuestionState.findOne({ question: question._id })
    expect(row.bookmarked).toBe(false)
  })

  it("skips questions with no author", async () => {
    const { user } = await createUser()
    const question = await createQuestion(user._id)
    await mongoose.connection
      .collection("mcqs")
      .updateOne(
        { _id: question._id },
        { $set: { bookmark: true }, $unset: { user: "" } }
      )

    const { migrated } = await migrateBookmarks()

    expect(migrated).toBe(0)
    expect(await UserQuestionState.countDocuments({})).toBe(0)
  })

  it("is a no-op on a database that has already been migrated", async () => {
    const { user } = await createUser()
    await createQuestion(user._id)

    const { migrated, unset } = await migrateBookmarks()

    expect(migrated).toBe(0)
    expect(unset).toBe(0)
    expect(await UserQuestionState.countDocuments({})).toBe(0)
  })
})
