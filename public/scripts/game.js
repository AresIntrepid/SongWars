// Enhanced Game Client-Side Logic
class SongWarsGame {
    constructor(gameCode, isHost = false) {
        // Validate gameCode
        if (!this.isValidGameCode(gameCode)) {
            throw new Error('Invalid game code');
        }
        
        this.gameCode = gameCode;
        this.socket = io();
        this.isHost = isHost;
        //default player time limit to upload song
        this.timeLimit = 60;
        this.timer = null;
        this.uploadInProgress = false;
        this.playerCount = 0;
        
        // Add rate limiting for votes
        this.lastVoteTime = 0;
        this.VOTE_COOLDOWN = 1000; // 1 second between votes
        
        this.setupSocketListeners();
        this.setupUIElements();
        
        // Initialize based on role
        if (this.isHost) {
            this.initializeHost();
        } else {
            this.initializePlayer();
        }
    }

    // Initialize host-specific functionality
    initializeHost() {
        this.socket.emit('host-game', this.gameCode);
        this.setupHostElements();
    }

    // Initialize player-specific functionality  
    initializePlayer() {
        // Player initialization logic here
    }

    // Setup host-specific UI elements
    setupHostElements() {
        this.hostElements = {
            ...this.elements,
            playerCount: document.getElementById('player-count'),
            playerList: document.getElementById('player-list'),
            startButton: document.getElementById('start-game'),
            copyButton: document.getElementById('copy-code'),
            timeLimitInput: document.getElementById('time-limit'),
            minPlayersInput: document.getElementById('min-players'),
            gameStatus: document.getElementById('game-status'),
            statusMessage: document.getElementById('status-message'),
            submissionList: document.getElementById('submission-list')
        };

        this.setupHostEventListeners();
    }

    // Setup host-specific event listeners
    setupHostEventListeners() {
        // Copy game code functionality
        if (this.hostElements.copyButton) {
            this.hostElements.copyButton.addEventListener('click', () => {
                this.copyGameCode();
            });
        }

        // Start game button
        if (this.hostElements.startButton) {
            this.hostElements.startButton.addEventListener('click', () => {
                this.startGameAsHost();
            });
        }
    }

    // Copy game code functionality
    copyGameCode() {
        navigator.clipboard.writeText(this.gameCode)
            .then(() => {
                const btn = this.hostElements.copyButton;
                const copyText = btn.querySelector('.copy-text');
                const copiedText = btn.querySelector('.copied-text');
                
                if (copyText && copiedText) {
                    copyText.style.display = 'none';
                    copiedText.style.display = 'inline';
                    
                    setTimeout(() => {
                        copyText.style.display = 'inline';
                        copiedText.style.display = 'none';
                    }, 2000);
                }
            })
            .catch(err => {
                console.error('Failed to copy code:', err);
                this.handleError('Failed to copy code to clipboard');
            });
    }

    // Start game as host
    startGameAsHost() {
        const timeLimit = parseInt(this.hostElements.timeLimitInput?.value || 60);
        const minPlayers = parseInt(this.hostElements.minPlayersInput?.value || 2);
        
        if (this.playerCount < minPlayers) {
            this.handleError(`Need at least ${minPlayers} players to start!`);
            return;
        }

        this.socket.emit('start-game', { 
            gameCode: this.gameCode, 
            timeLimit,
            minPlayers
        });

        this.showGameStatus();
        this.startTimer(timeLimit);
    }

    // Show game status section
    showGameStatus() {
        if (this.hostElements.gameStatus) {
            this.hostElements.gameStatus.style.display = 'block';
        }
        if (this.hostElements.statusMessage) {
            this.hostElements.statusMessage.textContent = 'Game Started! Players are now submitting songs...';
        }
    }

    // Update player count display
    updatePlayerCount(count) {
        this.playerCount = count;
        if (this.hostElements.playerCount) {
            this.hostElements.playerCount.textContent = count;
        }
    }

    // Update player list display
    updatePlayerList(players) {
        if (!this.hostElements.playerList) return;

        if (players.length === 0) {
            this.hostElements.playerList.innerHTML = '<li class="player-item">Waiting for players to join...</li>';
        } else {
            this.hostElements.playerList.innerHTML = players.map(player => 
                `<li class="player-item">${this.sanitizeText(player.name)}</li>`
            ).join('');
        }
    }

    // Add player to list
    addPlayerToList(playerName) {
        if (!this.hostElements.playerList) return;

        // Clear waiting message if this is first player
        if (this.playerCount === 1) {
            this.hostElements.playerList.innerHTML = '';
        }

        const li = this.createElement('li', 'player-item', this.sanitizeText(playerName));
        this.hostElements.playerList.appendChild(li);
    }

    // Handle song submission for host view
    handleSongSubmissionForHost(data) {
        if (!this.hostElements.submissionList) return;

        const li = this.createElement('li', 'submission-item', 
            `${this.sanitizeText(data.playerName)} submitted "${this.sanitizeText(data.songName)}"`);
        this.hostElements.submissionList.appendChild(li);
    }

    // Validate game code format
    isValidGameCode(code) {
        // Assuming game codes are alphanumeric, 4-8 characters
        return /^[A-Za-z0-9]{4,8}$/.test(code);
    }

    // Validate file before processing
    isValidAudioFile(file) {
        const allowedTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'];
        const maxSize = 10 * 1024 * 1024; // 10MB limit
        
        if (!allowedTypes.includes(file.type)) {
            this.handleError('Please upload a valid audio file (MP3, WAV, OGG, or M4A)');
            return false;
        }
        
        if (file.size > maxSize) {
            this.handleError('File too large. Maximum size is 10MB');
            return false;
        }
        
        return true;
    }

    // Validate song name
    isValidSongName(name) {
        if (!name || typeof name !== 'string') return false;
        if (name.length < 1 || name.length > 100) return false;
        // Allow letters, numbers, spaces, and common punctuation
        return /^[A-Za-z0-9\s\-_'".!?()&]+$/.test(name);
    }

    // Validate ID format (assuming UUIDs or similar)
    isValidId(id) {
        return /^[A-Za-z0-9\-_]{1,50}$/.test(id);
    }

    // Sanitize text content
    sanitizeText(text) {
        if (typeof text !== 'string') return 'An error occurred';
        return text.replace(/[<>]/g, '').substring(0, 200); // Remove < > and limit length
    }

    // Helper method for creating elements with text content
    createElement(tag, className = '', textContent = '') {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (textContent) element.textContent = textContent;
        return element;
    }

    setupUIElements() {
        this.elements = {
            uploadSection: document.getElementById('upload-section'),
            waitingSection: document.getElementById('waiting-section'),
            bracketSection: document.getElementById('bracket-section'),
            timerDisplay: document.getElementById('timer'),
            matchupsContainer: document.getElementById('matchups'),
            winnerSection: document.getElementById('winner-section')
        };
    }

    // Enhanced socket listeners with validation
    setupSocketListeners() {
        // Host-specific events
        if (this.isHost) {
            this.socket.on('host-joined', (data) => {
                console.log('Host joined successfully:', data);
                this.updatePlayerCount(data.playerCount);
                this.updatePlayerList(data.players || []);
            });

            this.socket.on('song-submitted', (data) => {
                if (data && data.playerName && data.songName) {
                    this.handleSongSubmissionForHost(data);
                }
            });
        }

        // Common events for both host and players
        this.socket.on('game-started', (data) => {
            const timeLimit = typeof data === 'number' ? data : data?.timeLimit;
            if (typeof timeLimit === 'number' && timeLimit > 0 && timeLimit <= 300) {
                this.handleGameStart(timeLimit);
            }
        });
        
        this.socket.on('player-joined', (data) => {
            if (data && typeof data.name === 'string' && this.isValidSongName(data.name)) {
                this.handlePlayerJoin(data);
                if (this.isHost && typeof data.playerCount === 'number') {
                    this.updatePlayerCount(data.playerCount);
                    this.addPlayerToList(data.name);
                }
            }
        });

        this.socket.on('player-left', (data) => {
            if (this.isHost && data) {
                this.playerCount = Math.max(0, this.playerCount - 1);
                this.updatePlayerCount(this.playerCount);
            }
        });
        
        this.socket.on('start-tournament', (data) => {
            if (this.validateServerData(data)) {
                this.handleTournamentStart(data);
            }
        });
        
        this.socket.on('winner', (winner) => {
            if (winner && typeof winner.name === 'string') {
                this.handleWinner(winner);
            }
        });
        
        this.socket.on('error', (message) => this.handleError(message));
        this.socket.on('game-ended', (reason) => this.handleGameEnd(reason));
    }

    // Validate data from server
    validateServerData(data) {
        if (!data || typeof data !== 'object') return false;
        if (!Array.isArray(data.matchups)) return false;
        if (typeof data.round !== 'number') return false;
        return true;
    }

    handleGameStart(timeLimit) {
        this.timeLimit = timeLimit;
        this.startTimer();
        if (this.elements.uploadSection) {
            this.elements.uploadSection.style.display = 'block';
        }
        if (this.elements.waitingSection) {
            this.elements.waitingSection.style.display = 'none';
        }
    }

    handlePlayerJoin(player) {
        const playerList = document.getElementById('player-list');
        if (playerList && !this.isHost) { // Only for non-host players
            const li = document.createElement('li');
            li.textContent = player.name; // Safe - uses textContent
            li.className = 'player-item';
            playerList.appendChild(li);
        }
    }

    startTimer() {
        let timeLeft = this.timeLimit;
        
        this.timer = setInterval(() => {
            timeLeft--;
            if (this.elements.timerDisplay) {
                this.elements.timerDisplay.textContent = `Time remaining: ${timeLeft}s`;
            }
            
            if (timeLeft <= 0) {
                clearInterval(this.timer);
                this.handleTimeUp();
            }
        }, 1000);
    }

    handleTimeUp() {
        if (this.elements.uploadSection) {
            // Safe - using textContent instead of innerHTML
            this.elements.uploadSection.innerHTML = '';
            const message = document.createElement('h3');
            message.textContent = "Time's up! Waiting for tournament to begin...";
            this.elements.uploadSection.appendChild(message);
        }
        this.uploadInProgress = false;
    }

    handleTournamentStart(data) {
        const { matchups, round } = data;
        if (this.elements.bracketSection) {
            this.elements.bracketSection.style.display = 'block';
            this.renderMatchups(matchups, round);
        }
    }

    // Safe DOM creation version of renderMatchups
    renderMatchups(matchups, round) {
        if (!this.elements.matchupsContainer) return;

        // Clear existing content
        this.elements.matchupsContainer.innerHTML = '';

        // Create round title
        const roundTitle = document.createElement('h3');
        roundTitle.textContent = `Round ${round}`;
        this.elements.matchupsContainer.appendChild(roundTitle);

        // Create each matchup
        matchups.forEach((pair, index) => {
            const matchupDiv = document.createElement('div');
            matchupDiv.className = 'matchup';

            // Match title
            const matchTitle = document.createElement('h4');
            matchTitle.textContent = `Match ${index + 1}`;
            matchupDiv.appendChild(matchTitle);

            // Songs container
            const songsContainer = document.createElement('div');
            songsContainer.className = 'matchup-songs';

            // Create each song entry
            pair.forEach(song => {
                const songEntry = this.createSongEntry(song);
                songsContainer.appendChild(songEntry);
            });

            matchupDiv.appendChild(songsContainer);
            this.elements.matchupsContainer.appendChild(matchupDiv);
        });
    }

    createSongEntry(song) {
        const songDiv = document.createElement('div');
        songDiv.className = 'song-entry';

        // Song name - Safe with textContent
        const songName = document.createElement('p');
        songName.textContent = song.name;
        songDiv.appendChild(songName);

        // Audio player
        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = song.url; // Note: Still validate URLs server-side
        audio.className = 'song-player';
        songDiv.appendChild(audio);

        // Vote button - Safe with addEventListener
        const voteButton = document.createElement('button');
        voteButton.textContent = 'Vote';
        voteButton.className = 'btn btn-primary';
        voteButton.addEventListener('click', () => {
            this.vote(song.id);
        });
        songDiv.appendChild(voteButton);

        return songDiv;
    }

    // Rate limiting for votes
    vote(songId) {
        const now = Date.now();
        if (now - this.lastVoteTime < this.VOTE_COOLDOWN) {
            this.handleError('Please wait before voting again');
            return;
        }
        
        // Validate songId format
        if (!this.isValidId(songId)) {
            this.handleError('Invalid song selection');
            return;
        }
        
        if (!this.uploadInProgress) {
            this.lastVoteTime = now;
            this.socket.emit('vote', { gameCode: this.gameCode, winner: { id: songId } });
        }
    }

    // Safe DOM creation version of handleWinner
    handleWinner(winner) {
        if (this.elements.bracketSection) {
            this.elements.bracketSection.style.display = 'none';
        }
        
        if (this.elements.winnerSection) {
            this.elements.winnerSection.style.display = 'block';
            
            // Clear existing content
            this.elements.winnerSection.innerHTML = '';
            
            // Create winner announcement
            const winnerDiv = document.createElement('div');
            winnerDiv.className = 'winner-announcement';
            
            // Winner title
            const title = document.createElement('h2');
            title.textContent = '🎉 Winner! 🎉';
            winnerDiv.appendChild(title);
            
            // Winner name - Safe with textContent
            const winnerName = document.createElement('p');
            winnerName.textContent = winner.name;
            winnerDiv.appendChild(winnerName);
            
            // Winner's song audio
            const audio = document.createElement('audio');
            audio.controls = true;
            audio.src = winner.url;
            audio.className = 'song-player';
            winnerDiv.appendChild(audio);
            
            this.elements.winnerSection.appendChild(winnerDiv);
        }
    }

    // Improved error handling with user-friendly messages
    handleError(message) {
        // Sanitize error message
        const sanitizedMessage = this.sanitizeText(message);
        
        // Log to console for debugging (but don't expose sensitive info)
        console.error('Game error:', sanitizedMessage);
        
        // Show user-friendly error
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = sanitizedMessage;
        errorDiv.style.cssText = 'background: #fee; color: #c33; padding: 10px; margin: 10px 0; border-radius: 5px;';
        
        // Remove error after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
        
        // Add to page
        const container = this.elements.uploadSection || document.body;
        container.insertBefore(errorDiv, container.firstChild);
    }

    handleGameEnd(reason) {
        const sanitizedReason = this.sanitizeText(reason);
        alert(`Game ended: ${sanitizedReason}`);
        window.location.href = '/';
    }

    // Enhanced submit song with validation
    async submitSong(file, songName) {
        if (!file || this.uploadInProgress) return;
        
        // Validate file
        if (!this.isValidAudioFile(file)) {
            return;
        }
        
        // Validate song name
        const sanitizedName = songName ? songName.trim() : file.name;
        if (!this.isValidSongName(sanitizedName)) {
            this.handleError('Song name contains invalid characters or is too long');
            return;
        }
        
        this.uploadInProgress = true;
        
        try {
            const reader = new FileReader();
            
            reader.onload = () => {
                const song = {
                    name: sanitizedName,
                    length: 0,
                    url: reader.result,
                    category: 'Unknown'
                };

                // Create temporary audio element to get song duration
                const audio = new Audio();
                
                audio.addEventListener('loadedmetadata', () => {
                    song.length = Math.round(audio.duration);
                    
                    // Validate duration
                    if (song.length < 1 || song.length > 600) { // 1 second to 10 minutes
                        this.handleError('Song must be between 1 second and 10 minutes long');
                        this.uploadInProgress = false;
                        return;
                    }
                    
                    this.socket.emit('submit-song', { gameCode: this.gameCode, song });
                });
                
                audio.addEventListener('error', () => {
                    this.handleError('Invalid audio file');
                    this.uploadInProgress = false;
                });
                
                // Set source after event listeners are attached
                audio.src = reader.result;
            };

            reader.onerror = () => {
                this.handleError('Error reading file');
                this.uploadInProgress = false;
            };

            reader.readAsDataURL(file);
            
        } catch (error) {
            this.handleError('Failed to process file');
            this.uploadInProgress = false;
        }
    }
}

// Safe initialization with host detection
let game;
document.addEventListener('DOMContentLoaded', () => {
    try {
        const gameCodeElement = document.getElementById('game-code');
        const gameCode = gameCodeElement?.textContent?.trim();
        
        // Detect if this is a host page (you can adjust this logic)
        const isHost = document.getElementById('start-game') !== null;
        
        if (gameCode) {
            game = new SongWarsGame(gameCode, isHost);
        }
    } catch (error) {
        console.error('Failed to initialize game:', error);
        alert('Failed to initialize game. Please refresh the page.');
    }
});