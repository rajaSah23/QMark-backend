const express = require('express');
const { connectToDB } = require('./db');
const globalMiddleware = require('./middleware/globalMiddleware');
const app = express();
require('dotenv').config();
const PORT = process.env.PORT||3000;
const routes = require('./routes/index');
cors = require('cors')


//Middlewares
app.use(express.json());
app.use(cors())

//Database connection
connectToDB();

// This will run for EVERY request
app.use(globalMiddleware);

//Go to routes
app.use("/api",routes);
// Default Route
app.get("/",(req,res)=>{
    res.json({
        test:"ok"
    })
});

app.listen(3000,()=>{
    console.log("Listening to the port :",PORT);
})