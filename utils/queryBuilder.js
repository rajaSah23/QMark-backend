"use strict"

const mongoose = require("mongoose")

/**
 * Builds a MongoDB $match stage for MCQ queries based on userId and query params.
 * @param {string} userId
 * @param {object} query - req.query
 * @returns {object} matchStage
 */
const buildQuestionMatchStage = (userId, query = {}) => {
  const matchStage = {}

  if (query?.search) {
    const searchRegex = new RegExp(query.search, "i")
    matchStage.$or = [
      { question: searchRegex },
      { tag: searchRegex },
      { options: searchRegex }
    ]
  }

  if (query?.bookmark) {
    matchStage.bookmark = query.bookmark === "true"
  }

  if (query?.subject && query.subject !== "all") {
    try {
      matchStage.subject = new mongoose.Types.ObjectId(query.subject)
    } catch (err) {
      console.warn("Invalid subject ID:", query.subject)
    }
  }

  if (query?.topic && query.topic !== "other") {
    try {
      matchStage.topic = new mongoose.Types.ObjectId(query.topic)
    } catch (err) {
      console.warn("Invalid topic ID:", query.topic)
    }
  }

  if (query?.difficulty) {
    matchStage.difficulty = query.difficulty
  }

  if (query?.status) {
    matchStage.status = query.status === "true"
  }

  if (userId) {
    matchStage.user = new mongoose.Types.ObjectId(userId)
  }

  return matchStage
}

/**
 * Builds a createdAt date range filter from query params.
 * @param {object} query - req.query
 * @returns {object|null}
 */
const buildCreatedAtFilter = (query = {}) => {
  if (!query?.startDate && !query?.endDate) return null

  const createdAt = {}

  if (query?.startDate) {
    const start = new Date(query.startDate)
    if (!Number.isNaN(start.getTime())) {
      createdAt.$gte = start
    }
  }

  if (query?.endDate) {
    const end = new Date(query.endDate)
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999)
      createdAt.$lte = end
    }
  }

  return Object.keys(createdAt).length > 0 ? createdAt : null
}

/**
 * Builds the $sort aggregation stages for MCQ list queries.
 * Supports: random, name, date sorting.
 * @param {object} query - req.query
 * @returns {{ stages: object[], meta: object }}
 */
const buildQuestionSortStages = (query = {}) => {
  const sortBy = ["random", "name", "date"].includes(query?.sortBy)
    ? query.sortBy
    : "date"
  const sortDirection = query?.sortDirection === "asc" ? 1 : -1

  if (sortBy === "name") {
    return {
      stages: [{ $sort: { question: sortDirection, _id: 1 } }],
      meta: {
        sortBy,
        sortDirection: sortDirection === 1 ? "asc" : "desc",
        randomSeed: null
      }
    }
  }

  if (sortBy === "date") {
    return {
      stages: [{ $sort: { createdAt: sortDirection, _id: 1 } }],
      meta: {
        sortBy,
        sortDirection: sortDirection === 1 ? "asc" : "desc",
        randomSeed: null
      }
    }
  }

  // Random sort
  const parsedSeed = parseInt(query?.randomSeed, 10)
  const randomSeed = Number.isFinite(parsedSeed) ? parsedSeed : Date.now()
  const randomMultiplier = (Math.abs(randomSeed) % 997) + 37
  const randomOffset = (Math.abs(randomSeed) % 1543) + 101

  return {
    stages: [
      {
        $addFields: {
          randomOrderKey: {
            $mod: [
              {
                $add: [
                  { $multiply: [{ $toLong: "$createdAt" }, randomMultiplier] },
                  randomOffset
                ]
              },
              2147483647
            ]
          }
        }
      },
      { $sort: { randomOrderKey: 1, _id: 1 } }
    ],
    meta: { sortBy, sortDirection: "asc", randomSeed }
  }
}

module.exports = {
  buildQuestionMatchStage,
  buildCreatedAtFilter,
  buildQuestionSortStages
}
