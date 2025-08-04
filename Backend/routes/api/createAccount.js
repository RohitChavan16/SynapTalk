const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const {v4 : uuid} = require('uuid')
const branch_to_code = {}
const account_type_to_code = {}
// Helper to generate a random account number
async function generateAccountNumber(customer_ID, account_type, branch) {
  return '' + branch_to_code[branch] + account_type_to_code[account_type] + customer_ID// 10-digit number prefixed with 'AC'
}

router.post('/', async (req, res) => {
  const { account_type, adds_on, branch, customer_ID } = req.body;

  if (!account_type || !Array.isArray(adds_on) || !branch || !customer_ID) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const account_number = await generateAccountNumber();

  try {
    const account = await prisma.account.create({
        data: {
            accountNumber: account_number,
            ifscCode: uuid(),
            type: account_type,
            addsOn: adds_on,
            branch: branch,
            createdAt: new Date(),
            userId: customer_ID
        }
    })
    await prisma.user.update({
        where: { customer_ID: customer_ID },
        data: {
            accounts: {
                push: account
            }
        }
    });

    res.status(201).json({
      message: 'Account created successfully.',
      account_number,
      user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});