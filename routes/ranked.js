const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Song = require('../models/Song');
const { isAuthenticated } = require('../middleware/auth');

// Route to display the ranked page
router.get('/', isAuthenticated, async (req, res) => {
    try {
        // Get top 100 users for the leaderboard
        const topUsers = await User.getTop100();
        res.render('ranked', { 
            user: req.user,
            topUsers,
            title: 'Ranked Mode'
        });
    } catch (error) {
        console.error('Error loading ranked page:', error);
        res.status(500).render('error', { 
            message: 'Error loading ranked page',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// Route to get a new song comparison
router.get('/get-comparison', isAuthenticated, async (req, res) => {
    try {
        // Get random songs for comparison from the same genre
        const comparison = await Song.getRandomComparison();
        res.json(comparison);
    } catch (error) {
        console.error('Error getting song comparison:', error);
        res.status(500).json({ 
            error: 'Error getting song comparison',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Route to handle song voting
router.post('/vote', isAuthenticated, async (req, res) => {
    try {
        const { winnerId, loserId } = req.body;

        // Find both songs
        const winner = await Song.findById(winnerId);
        const loser = await Song.findById(loserId);

        if (!winner || !loser) {
            return res.status(404).json({ error: 'Songs not found' });
        }

        // Update ELO ratings for both songs
        await winner.updateElo(loser.elo, true);
        await loser.updateElo(winner.elo, false);

        // Update ELO ratings for both artists
        const winnerArtist = await User.findById(winner.artist);
        const loserArtist = await User.findById(loser.artist);

        if (winnerArtist && loserArtist) {
            await winnerArtist.updateElo(loserArtist.elo, true);
            await loserArtist.updateElo(winnerArtist.elo, false);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error processing vote:', error);
        res.status(500).json({ 
            error: 'Error processing vote',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
    try {
        const top100 = await User.getTop100();
        res.json(top100);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

module.exports = router; 