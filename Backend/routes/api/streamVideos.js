const router = require('express').Router();
const {streamVideosController} = require('../../controllers/videosController')

router.post('/', streamVideosController);

module.exports = router