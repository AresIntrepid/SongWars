const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'public/uploads/profile-pictures/';
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Create unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Check file type
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Middleware to ensure user is authenticated
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/auth/login');
}

// GET profile page
router.get('/', ensureAuthenticated, async (req, res) => {
    try {
        // Get updated user data
        const user = await User.findById(req.user.id);
        
        // Genres from your User model
        const genres = ['Pop', 'Rock', 'Hip Hop', 'R&B', 'Electronic', 'Classical', 'Jazz', 'Country', 'Metal', 'Folk', 'Blues', 'Reggae', 'Latin', 'World', 'Other'];
        
        res.render('profile', {
            user: user,
            genres: genres,
            currentPage: 'profile'
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        res.status(500).send('Error loading profile');
    }
});

// POST update profile picture
router.post('/update-picture', ensureAuthenticated, upload.single('profilePicture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Delete old profile picture if it exists and isn't the default
        if (req.user.profilePicture && 
            req.user.profilePicture !== '/images/default-profile.png' && 
            req.user.profilePicture.startsWith('/uploads/')) {
            const oldPath = path.join(__dirname, '..', 'public', req.user.profilePicture);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }

        // Update user profile picture path
        const profilePicturePath = `/uploads/profile-pictures/${req.file.filename}`;
        await User.findByIdAndUpdate(req.user.id, {
            profilePicture: profilePicturePath
        });

        res.json({
            success: true,
            profilePicture: profilePicturePath
        });
    } catch (error) {
        console.error('Error updating profile picture:', error);
        res.status(500).json({ error: 'Failed to update profile picture' });
    }
});

// POST upload song
router.post('/upload-song', ensureAuthenticated, async (req, res) => {
    try {
        const { title, genre } = req.body;
        
        if (!title || !genre) {
            return res.status(400).json({ error: 'Title and genre are required' });
        }

        // For now, we'll use a placeholder URL since you have songs embedded in User model
        // You might want to implement actual file upload for songs later
        const songData = {
            title: title,
            genre: genre,
            url: 'placeholder-url' // You'll need to implement song file upload
        };

        // Add song to user using the existing method
        const user = await User.findById(req.user.id);
        await user.addSong(songData);

        res.json({ success: true });
    } catch (error) {
        console.error('Error uploading song:', error);
        res.status(500).json({ error: 'Failed to upload song' });
    }
});

// DELETE song
router.delete('/delete-song/:id', ensureAuthenticated, async (req, res) => {
    try {
        const songId = req.params.id;
        
        // Remove song from user's songs array
        await User.findByIdAndUpdate(req.user.id, {
            $pull: { songs: { _id: songId } }
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting song:', error);
        res.status(500).json({ error: 'Failed to delete song' });
    }
});

module.exports = router;