//server code

require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
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
const server = http.createServer(app);
const io = socketIo(server);

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

// Socket.IO Game Logic
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    
    // Join a game room
    socket.on('join-game', (data) => {
        const { gameCode, playerName } = data;
        
        // Validate inputs
        if (!gameCode || !playerName) {
            socket.emit('error', 'Missing game code or player name');
            return;
        }
        
        // Validate game code format
        if (!/^[A-Za-z0-9]{4,8}$/.test(gameCode)) {
            socket.emit('error', 'Invalid game code format');
            return;
        }
        
        // Validate player name
        if (typeof playerName !== 'string' || playerName.length < 1 || playerName.length > 50) {
            socket.emit('error', 'Player name must be 1-50 characters');
            return;
        }
        
        // Sanitize player name
        const sanitizedName = playerName.replace(/[<>]/g, '').trim();
        
        // Get or create game
        if (!games.has(gameCode)) {
            games.set(gameCode, {
                players: new Map(),
                songs: new Map(),
                status: 'waiting', // waiting, uploading, tournament, finished
                round: 0,
                bracket: [],
                timeLimit: 60
            });
        }
        
        const game = games.get(gameCode);
        
        // Check if game is full (optional limit)
        if (game.players.size >= 10) {
            socket.emit('error', 'Game is full');
            return;
        }
        
        // Add player to game
        game.players.set(socket.id, {
            id: socket.id,
            name: sanitizedName,
            gameCode: gameCode
        });
        
        // Join socket room
        socket.join(gameCode);
        
        // Notify other players
        socket.to(gameCode).emit('player-joined', { name: sanitizedName });
        
        console.log(`Player ${sanitizedName} joined game ${gameCode}`);
    });
    
    // Start game (upload phase)
    socket.on('start-game', (data) => {
        const { gameCode } = data;
        const game = games.get(gameCode);
        
        if (!game) {
            socket.emit('error', 'Game not found');
            return;
        }
        
        game.status = 'uploading';
        
        // Start upload timer
        io.to(gameCode).emit('game-started', game.timeLimit);
        
        // Auto-start tournament after time limit
        setTimeout(() => {
            startTournament(gameCode);
        }, game.timeLimit * 1000);
    });
    
    // Handle song submission
    socket.on('submit-song', (data) => {
        const { gameCode, song } = data;
        const game = games.get(gameCode);
        
        if (!game || game.status !== 'uploading') {
            socket.emit('error', 'Cannot submit song at this time');
            return;
        }
        
        // Validate song data
        if (!song || !song.name || !song.url) {
            socket.emit('error', 'Invalid song data');
            return;
        }
        
        // Enhanced validation
        if (typeof song.name !== 'string' || song.name.length > 100) {
            socket.emit('error', 'Invalid song name');
            return;
        }
        
        if (typeof song.url !== 'string' || !song.url.startsWith('data:audio/')) {
            socket.emit('error', 'Invalid audio file');
            return;
        }
        
        if (song.length && (song.length < 1 || song.length > 600)) {
            socket.emit('error', 'Song must be between 1 second and 10 minutes');
            return;
        }
        
        // Sanitize song name
        const sanitizedName = song.name.replace(/[<>]/g, '').trim();
        
        // Add song to game
        game.songs.set(socket.id, {
            id: socket.id,
            name: sanitizedName,
            url: song.url,
            length: song.length || 0,
            category: 'Unknown'
        });
        
        console.log(`Song submitted: ${sanitizedName} in game ${gameCode}`);
    });
    
    // Handle voting
    socket.on('vote', (data) => {
        const { gameCode, winner } = data;
        const game = games.get(gameCode);
        
        if (!game || game.status !== 'tournament') {
            socket.emit('error', 'Cannot vote at this time');
            return;
        }
        
        // Process vote (simplified - you'd want more sophisticated logic)
        console.log(`Vote received for ${winner.id} in game ${gameCode}`);
        
        // For demo, just pick a winner after first vote
        const songs = Array.from(game.songs.values());
        if (songs.length > 0) {
            const winnerSong = songs[0]; // Simplified winner selection
            io.to(gameCode).emit('winner', winnerSong);
            game.status = 'finished';
        }
    });
    
    // Handle disconnect
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        
        // Remove player from all games
        for (const [gameCode, game] of games) {
            if (game.players.has(socket.id)) {
                const player = game.players.get(socket.id);
                game.players.delete(socket.id);
                game.songs.delete(socket.id);
                
                // Notify other players
                socket.to(gameCode).emit('player-left', { name: player.name });
                
                // Clean up empty games
                if (game.players.size === 0) {
                    games.delete(gameCode);
                }
            }
        }
    });
});

// Helper function to start tournament
function startTournament(gameCode) {
    const game = games.get(gameCode);
    if (!game) return;
    
    const songs = Array.from(game.songs.values());
    if (songs.length < 2) {
        io.to(gameCode).emit('error', 'Not enough songs to start tournament');
        return;
    }
    
    game.status = 'tournament';
    game.round = 1;
    
    // Create simple bracket (pair songs randomly)
    const matchups = [];
    for (let i = 0; i < songs.length; i += 2) {
        if (i + 1 < songs.length) {
            matchups.push([songs[i], songs[i + 1]]);
        }
    }
    
    game.bracket = matchups;
    
    // Start first round
    io.to(gameCode).emit('start-tournament', {
        matchups: matchups,
        round: game.round
    });
    
    console.log(`Tournament started for game ${gameCode} with ${songs.length} songs`);
}

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
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Socket.IO server ready`);
});