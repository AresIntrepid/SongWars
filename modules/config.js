// Load environment variables from .env file
require('dotenv').config();

// Check if required environment variables exist
const requiredEnvVars = [
    'MONGODB_URI', 
    'EMAIL_USER', 
    'EMAIL_PASSWORD', 
    'SESSION_SECRET'
];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Error: ${envVar} is required in environment variables`);
        process.exit(1);
    }
}

// Configuration object containing all application settings
const config = {
    // Application name - defaults to "SongWars" if not provided in env
    appName: process.env.APP_NAME,

    // Server port - defaults to 3000 if not provided in env
    port: process.env.PORT,

    // MongoDB connection string - required from environment variables
    mongoURI: process.env.MONGODB_URI,

    // Application environment (development/production) - defaults to development
    environment: process.env.NODE_ENV,

    // Maximum file upload size - defaults to 50mb
    maxUploadSize: process.env.MAX_UPLOAD_SIZE,

    // Email configuration
    emailUser: process.env.EMAIL_USER,
    emailPassword: process.env.EMAIL_PASSWORD,

    // Session secret
    sessionSecret: process.env.SESSION_SECRET,

    // Game specific settings
    defaultTimeLimit: 60,  // Default time limit for song submissions (in seconds)
    minPlayers: 2,        // Minimum number of players required to start a game
    maxPlayers: 10        // Maximum number of players allowed in a game
};

// Export the configuration object to be used in other parts of the application
module.exports = config;