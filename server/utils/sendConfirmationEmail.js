import transporter from "../config/nodemailer.js";
import logger from "../lib/logger.js";


export const sendConfirmationEmail = async (to, subject, htmlContent, attachments = []) => {
  const mailOptions = {
    from: process.env.SENDER_EMAIL,
    to: to,
    subject: subject,
    html: htmlContent,
    ...(attachments.length > 0 && { attachments }), 
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(`📧 Email sent successfully to ${to}:`, info.messageId);
  } catch (error) {
    console.error(`❌ Email failed to ${to}:`, error.message);
  }
};
