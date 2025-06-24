// Game Client-Side Logic
class SongWarsGame {
    constructor(gameCode) {
        this.gameCode = gameCode;
        this.socket = io();
        this.timeLimit = 60;
        this.timer = null;
        this.uploadInProgress = false;
        this.setupSocketListeners();
        this.setupUIElements();
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

    setupSocketListeners() {
        this.socket.on('game-started', (timeLimit) => this.handleGameStart(timeLimit));
        this.socket.on('player-joined', (player) => this.handlePlayerJoin(player));
        this.socket.on('start-tournament', (data) => this.handleTournamentStart(data));
        this.socket.on('winner', (winner) => this.handleWinner(winner));
        this.socket.on('error', (message) => this.handleError(message));
        this.socket.on('game-ended', (reason) => this.handleGameEnd(reason));
    }

    handleGameStart(timeLimit) {
        this.timeLimit = timeLimit;
        this.startTimer();
        this.elements.uploadSection.style.display = 'block';
        this.elements.waitingSection.style.display = 'none';
    }

    handlePlayerJoin(player) {
        const playerList = document.getElementById('player-list');
        if (playerList) {
            const li = document.createElement('li');
            li.textContent = player.name;
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
            this.elements.uploadSection.innerHTML = '<h3>Time\'s up! Waiting for tournament to begin...</h3>';
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

    renderMatchups(matchups, round) {
        if (!this.elements.matchupsContainer) return;

        this.elements.matchupsContainer.innerHTML = `
            <h3>Round ${round}</h3>
            ${matchups.map((pair, index) => `
                <div class="matchup">
                    <h4>Match ${index + 1}</h4>
                    <div class="matchup-songs">
                        ${pair.map(song => `
                            <div class="song-entry">
                                <p>${song.name}</p>
                                <audio controls src="${song.url}" class="song-player"></audio>
                                <button onclick="game.vote('${song.id}')" class="btn btn-primary">Vote</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        `;
    }

    vote(songId) {
        if (!this.uploadInProgress) {
            this.socket.emit('vote', { gameCode: this.gameCode, winner: { id: songId } });
        }
    }

    handleWinner(winner) {
        if (this.elements.bracketSection) {
            this.elements.bracketSection.style.display = 'none';
        }
        if (this.elements.winnerSection) {
            this.elements.winnerSection.style.display = 'block';
            this.elements.winnerSection.innerHTML = `
                <div class="winner-announcement">
                    <h2>🎉 Winner! 🎉</h2>
                    <p>${winner.name}</p>
                    <audio controls src="${winner.url}" class="song-player"></audio>
                </div>
            `;
        }
    }

    handleError(message) {
        alert(`Error: ${message}`);
    }

    handleGameEnd(reason) {
        alert(`Game ended: ${reason}`);
        window.location.href = '/';
    }

    async submitSong(file, songName) {
        if (!file || this.uploadInProgress) return;
        
        this.uploadInProgress = true;
        const reader = new FileReader();
        
        reader.onload = () => {
            const song = {
                name: songName || file.name,
                length: 0, // Will be set when audio loads
                url: reader.result,
                category: 'Unknown'
            };

            // Create temporary audio element to get song duration
            const audio = new Audio(reader.result);
            audio.addEventListener('loadedmetadata', () => {
                song.length = Math.round(audio.duration);
                this.socket.emit('submit-song', { gameCode: this.gameCode, song });
            });
        };

        reader.onerror = () => {
            this.handleError('Error reading file');
            this.uploadInProgress = false;
        };

        reader.readAsDataURL(file);
    }
}

// Initialize game instance when page loads
let game;
document.addEventListener('DOMContentLoaded', () => {
    const gameCode = document.getElementById('game-code')?.textContent;
    if (gameCode) {
        game = new SongWarsGame(gameCode);
    }
});