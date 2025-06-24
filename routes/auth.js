const express = require('express');
const router = express.Router();
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');
const { isAuthenticated, isGuest } = require('../middleware/auth');
const nodemailer = require('nodemailer');

// Configure Local Strategy
passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, async (email, password, done) => {
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return done(null, false, { message: 'Incorrect email or password.' });
        }
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return done(null, false, { message: 'Incorrect email or password.' });
        }
        return done(null, user);
    } catch (error) {
        return done(error);
    }
}));

// Serialize user for the session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

// Deserialize user from the session
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error);
    }
});

// Configure email transporter for verification emails
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Route to display login page
router.get('/login', isGuest, (req, res) => {
    res.render('login', { 
        title: 'Login',
        error: req.flash('error')
    });
});

// Route to handle login form submission
router.post('/login', isGuest, passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/auth/login',
    failureFlash: true
}));

// Route to display registration page
router.get('/register', isGuest, (req, res) => {
    res.render('register', { 
        title: 'Register',
        error: req.flash('error')
    });
});

// Route to handle registration form submission
router.post('/register', isGuest, async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if username or email already exists
        const existingUser = await User.findOne({ 
            $or: [{ username }, { email }] 
        });
        if (existingUser) {
            req.flash('error', 'Username or email already exists');
            return res.redirect('/auth/register');
        }

        // Create new user
        const user = new User({
            username,
            email,
            password
        });

        // Generate verification code
        const verificationCode = user.generateVerificationCode();
        await user.save();

        // Send verification email
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Verify your email',
            html: `
                <h1>Welcome to SongWars!</h1>
                <p>Your verification code is: <strong>${verificationCode}</strong></p>
                <p>This code will expire in 24 hours.</p>
                <p>If you didn't create an account, please ignore this email.</p>
            `
        };

        await transporter.sendMail(mailOptions);

        req.flash('success', 'Registration successful! Please check your email to verify your account.');
        res.redirect('/auth/login');
    } catch (error) {
        console.error('Registration error:', error);
        req.flash('error', 'An error occurred during registration');
        res.redirect('/auth/register');
    }
});

// Route to handle email verification
router.get('/verify/:code', isGuest, async (req, res) => {
    try {
        const { code } = req.params;
        const user = await User.findOne({
            verificationCode: code,
            verificationCodeExpires: { $gt: Date.now() }
        });

        if (!user) {
            req.flash('error', 'Invalid or expired verification code');
            return res.redirect('/auth/login');
        }

        // Mark email as verified
        user.isVerified = true;
        user.verificationCode = null;
        user.verificationCodeExpires = null;
        await user.save();

        req.flash('success', 'Email verified successfully! You can now log in.');
        res.redirect('/auth/login');
    } catch (error) {
        console.error('Verification error:', error);
        req.flash('error', 'An error occurred during verification');
        res.redirect('/auth/login');
    }
});

// Route to handle logout
router.get('/logout', isAuthenticated, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
        }
        res.redirect('/auth/login');
    });
});

module.exports = router; 