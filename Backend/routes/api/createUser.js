const router = require('express').Router();
const {createUser, verifyPhone, verifyEmail} = require('../../controllers/createUserController')

router.post('/details', createUser);
router.post('/verification/phone', verifyPhone);
router.post('/verification/email', verifyEmail);

module.exports = router