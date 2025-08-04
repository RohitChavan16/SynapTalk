const router = require('express').Router();
const feedbackController = require('../../controllers/feedbackController')

router.post('/', feedbackController);

module.exports = router