const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    customerId : {type : String, required: true},
    feedback : {
        type : String, required: true
    },
    from : {
        type: String, required : true
    },
    date: {type : Date, default: Date.now}
})

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;