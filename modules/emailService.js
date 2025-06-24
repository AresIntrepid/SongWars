const nodemailer = require('nodemailer');
const config = require('./config');

// Create a transporter using SMTP
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: config.emailUser,
        pass: config.emailPassword
    }
});

// Function to send verification email
const sendVerificationEmail = async (email, verificationCode) => {
    const mailOptions = {
        from: config.emailUser,
        to: email,
        subject: 'Verify your SongWars account',
        html: `
            <h1>Welcome to SongWars!</h1>
            <p>Thank you for creating an account. Please use the following verification code to verify your email:</p>
            <h2 style="color: #007bff; font-size: 32px; letter-spacing: 5px;">${verificationCode}</h2>
            <p>This code will expire in 24 hours.</p>
            <p>If you didn't create an account with SongWars, please ignore this email.</p>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        return true;
    } catch (error) {
        console.error('Error sending verification email:', error);
        return false;
    }
};

module.exports = {
    sendVerificationEmail
}; 