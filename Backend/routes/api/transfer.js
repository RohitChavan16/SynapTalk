const router = require('express').Router();
const transferMoney = require('../../controllers/transferMoney')

router.post('/', transferMoney);

module.exports = router