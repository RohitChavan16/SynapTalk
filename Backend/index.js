const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
const PORT = process.env.PORT || 3000;
const transfer = require('./routes/api/transfer')
const transactionHistory = require('./routes/api/transactionHistory')
const dashboard = require('./routes/api/dashboard')
const createUser = require('./routes/api/createUser')
const login = require('./routes/api/login')
// Middleware
app.use(express.json());
app.use(cookieParser())
// Routes

// app.use('/transfer',transfer);
// app.use('/history', transactionHistory);
// app.use('/dashboard', dashboard);
app.use('/login', login);
app.use('/createUser', createUser);
// app.use('/loan', loan);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});