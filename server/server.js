import express from 'express'
import "dotenv/config";
import cors from "cors";
import http from "http";
import { connectDB } from './lib/mongodb.js';
import userRouter from './routes/userRoutes.js';

const app = express();
const server = http.createServer(app);

app.use(express.json({limit: "4mb"}));
app.use(cors());


app.use("/", (req, res) => {
      res.send("Api is working   at its Best");
})
app.use("/api/auth", userRouter);


await connectDB();

const PORT = process.env.PORT || 5001;
server.listen(PORT, (req, res) => {
       console.log(`Server is running on port ${PORT}`);
});