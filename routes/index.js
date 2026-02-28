const express = require('express');
const router = express.Router();
const userRoutes = require('./userRoutes.js');
const mcqRoutes = require('./mcqRoutes.js');
const masterRoutes = require('./masterRoutes.js');
const quizRoutes = require('./quizRoutes.js');
const performanceRoutes = require('./performanceRoutes.js');

router.use("/user", userRoutes);
router.use("/mcq", mcqRoutes);
router.use("/master", masterRoutes);
router.use("/quiz", quizRoutes);
router.use("/performance", performanceRoutes);

// Default Route
router.get("/", (req, res) => {
    res.json({
        test: "API health is ok"
    })
});

module.exports = router;