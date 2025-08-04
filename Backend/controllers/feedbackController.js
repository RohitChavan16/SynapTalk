const Feedback = require('../mongoSchema/feeback')

const feedbackController = async (req, res) => {
    const {feedback, customer_ID, from} = req.body;
    try{
    await Feedback.create({
        customerId: customer_ID,
        feedback: feedback,
        from: from
    })
    res.status(200).json({"success" : "feedback stored successfully"})
}
catch(err){
    console.log(err)
    res.status(500).json({"error" : "feedback could not be stored"})
}   
}

module.exports = feedbackController;