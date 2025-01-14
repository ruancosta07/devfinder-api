import Nodemailer from "nodemailer";
const emailPass = process.env.EMAIL_PASS as string;
const testAccount = await Nodemailer.createTestAccount();
const nodemailer = Nodemailer.createTransport({
  host: testAccount.smtp.host,
  port: testAccount.smtp.port,
  secure: testAccount.smtp.secure,
  auth: {
    user: testAccount.user,
    pass: testAccount.pass,
  },
});

export default nodemailer;
