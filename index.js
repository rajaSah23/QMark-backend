"use strict"

require("dotenv").config()
const app = require("./app")
const { connectToDB } = require("./config/db")

const PORT = process.env.PORT || 3000

// Connect to MongoDB
connectToDB()

// Start server
app.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}`)
})