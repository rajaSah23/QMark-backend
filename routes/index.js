const express = require('express');
const { MCQController } = require('../controller/mcqController');
const router = express.Router();
const userRoutes = require('./userRoutes.js');
const mcqRoutes = require('./mcqRoutes.js');
const masterRoutes = require('./masterRoutes.js');

router.use("/user",userRoutes);


router.use("/mcq",mcqRoutes);
router.use("/master",masterRoutes);



// Default Route
router.get("/",(req,res)=>{
    res.json({
        test:"API health is ok"
    })
});

module.exports = router;