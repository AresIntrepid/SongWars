const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Schema for individual songs in a user's collection
const SongSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
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
    }
});

// Main User Schema
const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationCode: {
        type: String,
        default: null
    },
    verificationCodeExpires: {
        type: Date,
        default: null
    },
    profilePicture: {
        type: String,
        default: '/images/default-profile.png'
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
    },
    rank: {
        type: Number,
        default: null
    },
    songs: [SongSchema],
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Hash password before saving to database
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Method to compare password for login
UserSchema.methods.comparePassword = async function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Method to generate verification code for email verification
UserSchema.methods.generateVerificationCode = function() {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.verificationCode = code;
    this.verificationCodeExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    return code;
};

// Static method to get top 100 users by ELO rating
UserSchema.statics.getTop100 = async function() {
    const users = await this.find()
        .sort({ elo: -1 })
        .limit(100)
        .select('username elo wins losses totalMatches profilePicture rank');
    
    // Add rank to each user
    return users.map((user, index) => {
        const userObj = user.toObject();
        userObj.rank = index + 1;
        return userObj;
    });
};

// Method to update user's ELO rating after a match
UserSchema.methods.updateElo = async function(opponentElo, won) {
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
    this.lastUpdated = new Date();
    
    await this.save();
};

// Method to add a new song to user's collection
UserSchema.methods.addSong = async function(songData) {
    this.songs.push({
        title: songData.title,
        genre: songData.genre,
        url: songData.url
    });
    await this.save();
};

module.exports = mongoose.model('User', UserSchema); 