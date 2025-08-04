const { PrismaClient } = require('../generate/prisma');
const prisma = new PrismaClient();

const getTransactionHistory = async (req, res) => {
  const { account_number } = req.body;

  if (!account_number) {
    return res.status(400).json({ error: 'account_number is required.' });
  }

  try {
    const transactions = await prisma.transaction.findMany({
      where: { 
        OR:{
        fromAccountId : account_number,
        toAccountId: account_number
        }
        // date: {
        //   gt: new Date(after_date)
        // }
       },
      orderBy: { timestamp: 'desc' },
      take: 10
    });

    res.status(200).json({ transactions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = getTransactionHistory;