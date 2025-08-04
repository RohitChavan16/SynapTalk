const router = require('express').Router();
const showDashboard = require('../../controllers/dashboard')

router.get('/', showDashboard);

module.exports = router