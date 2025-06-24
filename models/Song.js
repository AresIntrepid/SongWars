const mongoose = require('mongoose');

// Schema for individual songs in the database
const SongSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    artist: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    genre: {
        type: String,
        required: true,
        enum: ['Pop', 'Rock', 'Hip Hop', 'R&B', 'Electronic', 'Classical', 'Jazz', 'Country', 'Metal', 'Folk', 'Blues', 'Reggae', 'Latin', 'World', 'Other']
    },
    url: {
        type: String,
        required: true
    },
    uploadDate: {
        type: Date,
        default: Date.now
    },
    elo: {
        type: Number,
        default: 1000,
        min: 0
    },
    wins: {
        type: Number,
        default: 0
    },
    losses: {
        type: Number,
        default: 0
    },
    totalMatches: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Static method to get random songs for comparison
SongSchema.statics.getRandomComparison = async function() {
    // Get all available genres
    const genres = await this.distinct('genre');
    if (genres.length === 0) {
        throw new Error('No songs available for comparison');
    }

    // Select a random genre
    const randomGenre = genres[Math.floor(Math.random() * genres.length)];

    // Get two random songs from the same genre
    const songs = await this.aggregate([
        { $match: { genre: randomGenre } },
        { $sample: { size: 2 } },
        {
            $lookup: {
                from: 'users',
                localField: 'artist',
                foreignField: '_id',
                as: 'artistInfo'
            }
        },
        { $unwind: '$artistInfo' }
    ]);

    if (songs.length !== 2) {
        throw new Error('Not enough songs in this genre for comparison');
    }

    return {
        genre: randomGenre,
        song1: {
            id: songs[0]._id,
            title: songs[0].title,
            url: songs[0].url,
            artist: songs[0].artistInfo.username,
            elo: songs[0].elo
        },
        song2: {
            id: songs[1]._id,
            title: songs[1].title,
            url: songs[1].url,
            artist: songs[1].artistInfo.username,
            elo: songs[1].elo
        }
    };
};

// Method to update song's ELO rating after a match
SongSchema.methods.updateElo = async function(opponentElo, won) {
    const K = 32; // K-factor for ELO calculation
    const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - this.elo) / 400));
    const actualScore = won ? 1 : 0;
    const eloChange = Math.round(K * (actualScore - expectedScore));
    
    this.elo += eloChange;
    if (won) {
        this.wins += 1;
    } else {
        this.losses += 1;
    }
    this.totalMatches += 1;
    
    await this.save();
};

// Static method to get top songs by genre
SongSchema.statics.getTopSongsByGenre = async function(genre, limit = 10) {
    return this.find({ genre })
        .sort({ elo: -1 })
        .limit(limit)
        .populate('artist', 'username profilePicture');
};

module.exports = mongoose.model('Song', SongSchema);