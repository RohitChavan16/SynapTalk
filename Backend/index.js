const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = process.env.PORT || 3000;
const transfer = require('./routes/api/transfer')
const transactionHistory = require('./routes/api/transactionHistory')
const dashboard = require('./routes/api/dashboard')
const createUser = require('./routes/api/createUser')
const login = require('./routes/api/login');
const logout =require('./routes/api/logout');
const verifySMPT = require('./routes/api/verifySMTPConnection')
const kycdocuments = require('./routes/api/kycdocuments')
const videoKYC = require('./routes/api/videoKYC')
const connectMongoDb = require('./config/mongodb')
require('dotenv').config()
// Middleware
app.use(express.json());
app.use(cookieParser())
app.use(express.urlencoded({extended: false}))
// Routes
app.use('/verifySMTP', verifySMPT)
app.use('/login', login);
app.use('/logout', logout)
app.use('/createUser', createUser);
// app.use('/transfer',transfer);
// app.use('/history', transactionHistory);
// app.use('/dashboard', dashboard);

// app.use('/loan', loan);
app.use('/KYCdocuments', kycdocuments)
app.use('/videoKYC', videoKYC)
// Start server
connectMongoDb()
.then( ()=> {
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
}
)
.catch((err) => {
  console.log("could not connect to mongodb")
  console.log(err);
})
