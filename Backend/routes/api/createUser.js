const router = require('express').Router();
const createUserController = require('../../controllers/createUserController')

router.post('/', createUserController);

module.exports = router