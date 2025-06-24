const User = require('../models/User');

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error', 'Please log in to access this page');
    res.redirect('/auth/login');
};

// Middleware to check if user is not authenticated (guest)
const isGuest = (req, res, next) => {
    if (!req.isAuthenticated()) {
        return next();
    }
    res.redirect('/');
};

// Middleware to attach user object to request
const attachUser = async (req, res, next) => {
    if (req.user) {
        try {
            const user = await User.findById(req.user.id);
            if (user) {
                req.user = user;
            }
        } catch (error) {
            console.error('Error attaching user:', error);
        }
    }
    next();
};

module.exports = {
    isAuthenticated,
    isGuest,
    attachUser
}; 