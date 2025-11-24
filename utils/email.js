const nodemailer = require("nodemailer");

let testAccount = null;

const getTransporter = async () => {
  // 1. If we have real SMTP credentials in .env, use them
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // 2. Fallback to Ethereal (fake email) for development
  if (!testAccount) {
    console.log("⚠️ No SMTP credentials found. Generating Ethereal test account...");
    testAccount = await nodemailer.createTestAccount();
    console.log("✅ Ethereal Account Created:", testAccount.user);
  }

  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
};

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = await getTransporter();

    const info = await transporter.sendMail({
      from: '"TourEase Support" <support@tourease.com>', // sender address
      to, // list of receivers
      subject, // Subject line
      text, // plain text body
      html, // html body
    });

    console.log("📨 Email sent: %s", info.messageId);

    // Preview only available when sending through an Ethereal account
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log("🔗 Preview URL: %s", previewUrl);
    }

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return { success: false, error };
  }
};

module.exports = { sendEmail };
