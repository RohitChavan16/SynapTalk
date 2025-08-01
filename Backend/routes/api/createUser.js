const router = require('express').Router();
const {createUser, verifyPhone} = require('../../controllers/createUserController')

router.post('/details', createUser);
router.post('/verification', verifyPhone);

module.exports = router