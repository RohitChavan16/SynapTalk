const { PrismaClient } = require('../generate/prisma');
const prisma = new PrismaClient();

const showDashboard = async (req, res) => {
  const { customer_ID } = req.body;

  if (!customer_ID) {
    return res.status(400).json({ error: 'customer_ID is required.' });
  }

  try {
    let user = await prisma.user.findUnique({
      where: { customer_ID }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    delete user.password
    res.status(200).json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  }
};

module.exports = showDashboard;