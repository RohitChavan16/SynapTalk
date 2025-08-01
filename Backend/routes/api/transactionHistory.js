const router = require('express').Router();
const getTransactionHistory = require('../../controllers/transactionHistory')

router.get('/', getTransactionHistory);

module.exports = router