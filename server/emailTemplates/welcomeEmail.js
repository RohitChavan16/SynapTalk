export const getWelcomeEmailHTML = (email, name) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to SynapTalk</title>
  <style>
    body {
      font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8f9fb;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      background: #ffffff;
      margin: 40px auto;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0,0,0,0.08);
    }
    .header {
      background-color: #2563eb;
      color: white;
      text-align: center;
      padding: 30px 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 30px 40px;
      color: #333;
    }
    .content h2 {
      margin-top: 0;
      color: #2563eb;
      font-size: 22px;
    }
    .content p {
      line-height: 1.6;
      font-size: 16px;
      margin-bottom: 16px;
    }
    .email-box {
      background: #f3f4f6;
      padding: 10px 15px;
      border-radius: 6px;
      font-family: monospace;
      color: #111827;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      margin-top: 20px;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
    }
    .footer {
      text-align: center;
      padding: 20px;
      font-size: 14px;
      color: #6b7280;
      background: #f9fafb;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to SynapTalk 🎉</h1>
    </div>
    <div class="content">
      <h2>Hello ${name || "there"},</h2>
      <p>
        We're absolutely thrilled to have you onboard! Your SynapTalk account has been
        created successfully using the email:
      </p>
      <div class="email-box">${email}</div>

      <p>
        You can now log in to start connecting, chatting, and collaborating with your team
        in real time — experience the future of communication with SynapTalk.
      </p>

      <a href="https://synaptalk.app/login" class="button">Get Started</a>

      <p>
        If you didn’t sign up for SynapTalk, please ignore this email or contact our
        support team for assistance.
      </p>

      <p>We’re excited to see what you’ll create and connect with SynapTalk! 🚀</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} SynapTalk. All rights reserved.</p>
      <p>Made with ❤️ by the SynapTalk Team</p>
    </div>
  </div>
</body>
</html>
`;
