require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const exphbs = require('express-handlebars');
const passport = require('passport');
const { attachUser } = require('./middleware/auth');

// Import routes
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const rankedRouter = require('./routes/ranked');

// Initialize Express app
const app = express();

// Initialize games Map
const games = new Map();
app.set('games', games);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Configure Handlebars
const hbs = exphbs.create({
    defaultLayout: 'main',
    extname: '.handlebars',
    runtimeOptions: {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true
    },
    helpers: {
        // Helper to format date
        formatDate: function(date) {
            return new Date(date).toLocaleDateString();
        },
        // Helper to check if user is logged in
        isLoggedIn: function(user) {
            return !!user;
        },
        // Helper to get user's rank
        getRank: function(elo) {
            if (elo >= 2000) return 'Grandmaster';
            if (elo >= 1800) return 'Master';
            if (elo >= 1600) return 'Diamond';
            if (elo >= 1400) return 'Platinum';
            if (elo >= 1200) return 'Gold';
            if (elo >= 1000) return 'Silver';
            return 'Bronze';
        },
        // Section helper for content blocks
        section: function(name, options) {
            if (!this._sections) this._sections = {};
            this._sections[name] = options.fn(this);
            return null;
        },
        // Helper to perform math operations
        add: function(a, b) {
            return a + b;
        },
        // Davis - added multiply, divide, eq helpers
        multiply: function(a, b) {
            return a * b;
        },
        divide: function(a, b) {
            return a / b;
        },
        eq: function(a, b) {
            return a == b;
        }
    }
});

// Configure middleware
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Passport and restore authentication state from session
app.use(passport.initialize());
app.use(passport.session());

// Configure flash messages
app.use(flash());

// Global variables for views
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error');
    res.locals.error = req.flash('error');
    next();
});

// Attach user to request
app.use(attachUser);

// Routes
app.use('/', indexRouter);
app.use('/auth', authRouter);
app.use('/ranked', rankedRouter);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});