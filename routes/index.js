const express = require('express');
const { MCQController } = require('../controller/mcqController');
const router = express.Router();
const userRoutes = require('./userRoutes.js');

router.use("/user",userRoutes);


router.get("/mcq",MCQController.getMCQs);
router.get("/mcq/:questionId",MCQController.getMCQById);
router.delete("/mcq/:questionId",MCQController.deleteMCQById);
router.post("/mcq",MCQController.postMCQ);
router.put("/mcq",MCQController.updateMCQ);


// Default Route
router.get("/",(req,res)=>{
    res.json({
        test:"API health is ok"
    })
});

module.exports = router;