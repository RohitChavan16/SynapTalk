const transferMoney = (req, res) => {
    const {amount, receiver_ac_no, sender_ac_no, message} = req.body;
    deductMoney(amount, sender_ac_no);
    receiveMoney(amount , receiver_ac_no);
    res.status(200).send(receipt);
}
const deductMoney = (amount, sender_ac_no)=> {
    console.log("deducted : "+ amount+ " from account : "+ sender_ac_no);
}
const receiveMoney = (amount, receiver_ac_no) => {
    console.log("received : " + amount + "from account : " + receiver_ac_no)
}
module.exports = transferMoney