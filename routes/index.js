const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Song = require('../models/Song');
const User = require('../models/User');
const config = require('../modules/config');
const { isAuthenticated } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Initialize games Map
const games = new Map();

// Configure multer for song uploads
// Sets up storage location and file naming for uploaded songs
const songStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'public/uploads/songs';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// Configure multer upload settings for songs
// Limits file size to 50MB and only allows MP3 and WAV files
const songUpload = multer({
    storage: songStorage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only MP3 and WAV files are allowed.'));
        }
    }
});

// Configure multer for profile picture uploads
// Sets up storage location and file naming for profile pictures
const profilePictureStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'public/uploads/profile-pictures';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

// Configure multer upload settings for profile pictures
// Limits file size to 5MB and only allows JPEG, PNG, and GIF files
const profilePictureUpload = multer({
    storage: profilePictureStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPEG, PNG, and GIF files are allowed.'));
        }
    }
});

// ===== Page Routes =====

router.get('/', async (req, res) => {
    const error = req.query.error;
    const leaderboard = await User.getTop100();
    res.render('landing', { 
        error,
        leaderboard,
        user: req.user
    });
});

router.get('/leaderboard', async (req, res) => {
    try {
        const leaderboard = await User.getTop100();
        res.render('leaderboard', { 
            leaderboard,
            user: req.user
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.render('leaderboard', { 
            leaderboard: [],
            error: 'Failed to load leaderboard',
            user: req.user
        });
    }
});

router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('songs');
        res.render('profile', { 
            user,
            genres: ['Pop', 'Rock', 'Hip Hop', 'R&B', 'Electronic', 'Classical', 'Jazz', 'Country', 'Metal', 'Folk', 'Blues', 'Reggae', 'Latin', 'World', 'Other']
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.redirect('/?error=profile_error');
    }
});

router.get('/ranked', async (req, res) => {
    try {
        const leaderboard = await User.getTop100();
        res.render('ranked', {
            leaderboard,
            user: req.user
        });
    } catch (error) {
        console.error('Error fetching ranked page:', error);
        res.render('ranked', {
            leaderboard: [],
            user: req.user,
            error: 'Failed to load ranked page'
        });
    }
});

router.get('/host', (req, res) => {
    const gameCode = uuidv4().slice(0, 6).toUpperCase();
    
    // Ensure unique game code
    while (games.has(gameCode)) {
        gameCode = uuidv4().slice(0, 6).toUpperCase();
    }
    
    // Initialize game state
    games.set(gameCode, {
        players: new Map(),
        songs: new Map(),
        status: 'waiting',
        timeLimit: config.defaultTimeLimit
    });
    
    res.redirect(`/host/${gameCode}`);
});

router.get('/host/:gameCode', (req, res) => {
    const gameCode = req.params.gameCode;

    if (!games.has(gameCode)) {
        return res.redirect('/?error=invalid_game');
    }

    const game = games.get(gameCode);
    res.render('host', {
        gameCode,
        playerCount: game.players.size,
        timeLimit: game.timeLimit,
        minPlayers: config.minPlayers,
        maxPlayers: config.maxPlayers
    });
});

router.get('/join', (req, res) => {
    const error = req.query.error;
    res.render('join', { error });
});

router.get('/game/:gameCode', (req, res) => {
    const gameCode = req.params.gameCode;
    
    if (!games.has(gameCode)) {
        return res.redirect('/join?error=invalid_game');
    }
    
    const game = games.get(gameCode);
    res.render('game', {
        gameCode,
        status: game.status,
        playerCount: game.players.size,
        timeLimit: game.timeLimit
    });
});

// ===== API Routes =====

router.post('/api/games', (req, res) => {
    const gameCode = uuidv4().slice(0, 6).toUpperCase();
    const { timeLimit } = req.body;
    
    if (timeLimit && (timeLimit < 30 || timeLimit > 300)) {
        return res.status(400).json({
            error: 'Time limit must be between 30 and 300 seconds'
        });
    }
    
    if (games.has(gameCode)) {
        return res.status(409).json({ error: 'Game code already exists' });
    }
    
    games.set(gameCode, {
        players: new Map(),
        songs: new Map(),
        status: 'waiting',
        timeLimit: timeLimit || config.defaultTimeLimit
    });
    
    res.json({ gameCode });
});

router.get('/api/games/:gameCode', (req, res) => {
    const gameCode = req.params.gameCode;
    
    if (!games.has(gameCode)) {
        return res.status(404).json({ error: 'Game not found' });
    }
    
    const game = games.get(gameCode);
    res.json({
        exists: true,
        playerCount: game.players.size,
        status: game.status,
        timeLimit: game.timeLimit
    });
});

router.post('/api/games/:gameCode/join', (req, res) => {
    const gameCode = req.params.gameCode;
    const { playerName } = req.body;
    
    if (!games.has(gameCode)) {
        return res.status(404).json({ error: 'Game not found' });
    }
    
    const game = games.get(gameCode);
    
    if (game.status !== 'waiting') {
        return res.status(400).json({ error: 'Game has already started' });
    }
    
    if (game.players.size >= config.maxPlayers) {
        return res.status(400).json({ error: 'Game is full' });
    }
    
    game.players.set(playerName, {
        id: uuidv4(),
        joinedAt: new Date(),
        ready: false
    });
    
    res.json({
        success: true,
        playerCount: game.players.size
    });
});

router.post('/api/games/:gameCode/start', (req, res) => {
    const gameCode = req.params.gameCode;
    const { timeLimit } = req.body;
    
    if (!games.has(gameCode)) {
        return res.status(404).json({ error: 'Game not found' });
    }
    
    const game = games.get(gameCode);
    
    if (game.players.size < config.minPlayers) {
        return res.status(400).json({ error: `Need at least ${config.minPlayers} players to start` });
    }
    
    game.status = 'active';
    if (timeLimit) {
        game.timeLimit = timeLimit;
    }
    
    const io = req.app.get('io');
    io.to(gameCode).emit('game-started', {
        timeLimit: game.timeLimit,
        playerCount: game.players.size
    });
    
    res.json({ success: true });
});

router.post('/api/games/:gameCode/songs', async (req, res) => {
    const gameCode = req.params.gameCode;
    const { songData, playerId } = req.body;
    
    if (!games.has(gameCode)) {
        return res.status(404).json({ error: 'Game not found' });
    }
    
    const game = games.get(gameCode);
    if (game.status !== 'active') {
        return res.status(400).json({ error: 'Game is not in song submission phase' });
    }
    
    try {
        const song = new Song({
            name: songData.name,
            length: songData.length,
            category: songData.category,
            url: songData.url,
            submittedBy: playerId,
            gameCode
        });
        
        await song.save();
        
        const io = req.app.get('io');
        io.to(gameCode).emit('song-submitted', {
            playerName: game.players.get(playerId),
            songName: song.name
        });
        
        res.json({ success: true, songId: song._id });
    } catch (error) {
        console.error('Error saving song:', error);
        res.status(500).json({ error: 'Failed to save song' });
    }
});

// Song upload endpoint
// Handles the upload of new songs
router.post('/api/songs/upload', isAuthenticated, songUpload.single('song'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const songData = {
            title: req.body.title,
            genre: req.body.genre,
            url: `/uploads/songs/${req.file.filename}`
        };

        await req.user.addSong(songData);
        res.json({ success: true });
    } catch (error) {
        console.error('Error uploading song:', error);
        res.status(500).json({ error: 'Failed to upload song' });
    }
});

// Delete song endpoint
router.delete('/api/songs/:songId', isAuthenticated, async (req, res) => {
    try {
        const song = req.user.songs.id(req.params.songId);
        if (!song) {
            return res.status(404).json({ error: 'Song not found' });
        }

        // Remove the song file
        const filePath = path.join(__dirname, '../public', song.url);
        fs.unlinkSync(filePath);

        // Remove the song from user's collection
        song.remove();
        await req.user.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting song:', error);
        res.status(500).json({ error: 'Failed to delete song' });
    }
});

// Profile picture upload route
// Handles the upload and update of user profile pictures
router.post('/profile/update-picture', isAuthenticated, profilePictureUpload.single('profilePicture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Delete old profile picture if it exists
        if (user.profilePicture && user.profilePicture !== '/images/default-profile.png') {
            const oldPicturePath = path.join(__dirname, '..', 'public', user.profilePicture);
            if (fs.existsSync(oldPicturePath)) {
                fs.unlinkSync(oldPicturePath);
            }
        }

        // Update user's profile picture path
        user.profilePicture = `/uploads/profile-pictures/${req.file.filename}`;
        await user.save();

        res.json({ profilePicture: user.profilePicture });
    } catch (error) {
        console.error('Error updating profile picture:', error);
        res.status(500).json({ error: 'Failed to update profile picture' });
    }
});

// Upload song route
// Handles the upload of new songs from the profile page
router.post('/profile/upload-song', isAuthenticated, songUpload.single('song'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { title, genre } = req.body;
        const user = await User.findById(req.user.id);

        // Create new song
        const song = new Song({
            title,
            genre,
            url: `/uploads/songs/${req.file.filename}`,
            uploadDate: new Date()
        });

        // Add song to user's collection
        user.songs.push(song);
        await user.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error uploading song:', error);
        res.status(500).json({ error: 'Failed to upload song' });
    }
});

// Delete song route
// Handles the deletion of songs from the user's profile
router.delete('/profile/delete-song/:songId', isAuthenticated, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const song = user.songs.id(req.params.songId);

        if (!song) {
            return res.status(404).json({ error: 'Song not found' });
        }

        // Delete file from storage
        const filePath = path.join(__dirname, '..', 'public', song.url);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Remove song from user's collection
        song.remove();
        await user.save();

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting song:', error);
        res.status(500).json({ error: 'Failed to delete song' });
    }
});

// Error handling middleware
router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

module.exports = router;