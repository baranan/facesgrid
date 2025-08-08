// =====================
// Face Grid Game - Refactored cells.js
// Modular, namespaced, heavily commented version
// =====================

/*
  This script manages the entire logic of the Face Grid Game, separating game logic,
  rendering, input handling, and game state using JavaScript const-based namespaces.
  It improves readability and maintainability compared to the monolithic structure.
*/

// =====================
// Game State Namespace
// =====================
const GameState = {
    canvas: document.getElementById('game-canvas'),
    ctx: null,
  
    board: [],             // 2D array of face cell objects
    path: [],              // Current selection path
    fallingCells: [],      // For drop animations
    faceImages: [],        // Loaded image objects
    correctSolvablePath: null,  // Hamiltonian solution (if used)
  
    gridSize: 5,
    movesLeft: 0,
    moves: 0,
    score: 0,
    total: 0,
  
    isMouseDown: false,
    manualSubmit: false,
    currentGroup: null,
    visitedGroups: new Set(),
    lastDirection: null,
    loopClosed: false,
    gameOn: false,
    quit: false,
  
    faceSet: 'none',  // e.g., "women"
    groups: ['black', 'green', 'red', 'gray', 'yellow'],
    facesPerGroup: 4,
    scoreDisplayMode: 'header',  // 'header' or 'canvas'
  
    lastSelectedGrid: null,
    lastSelectedMoves: null,
    cellSize: 0
  };
  
  GameState.ctx = GameState.canvas.getContext('2d');
  
  // =====================
  // Utility Namespace
  // =====================
  const Utils = {
    // Shuffle an array in place using Fisher-Yates algorithm
    shuffleArray(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    },
  
    // Check whether a given cell coordinate is inside the grid
    isInGrid(x, y) {
      return x >= 0 && y >= 0 && x < GameState.gridSize && y < GameState.gridSize;
    },
  
    // Convert a mouse/touch event to grid cell coordinates (with boundary tolerance)
    getCellFromEvent(evt) {
      const rect = GameState.canvas.getBoundingClientRect();
      const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
      const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
      const scaleX = GameState.canvas.width / rect.width;
      const scaleY = GameState.canvas.height / rect.height;
      const offsetX = (clientX - rect.left) * scaleX;
      const offsetY = (clientY - rect.top) * scaleY;
      const x = Math.floor(offsetX / GameState.cellSize);
      const y = Math.floor(offsetY / GameState.cellSize);
      const fracX = (offsetX % GameState.cellSize) / GameState.cellSize;
      const fracY = (offsetY % GameState.cellSize) / GameState.cellSize;
      if (fracX > 0.2 && fracX < 0.8 && fracY > 0.2 && fracY < 0.8) {
        return { x, y };
      } else {
        return null;
      }
    },
  
    // Update whether the current path forms a closed loop
    getLoopClosed() {
      const start = GameState.path[0];
      return GameState.path.length > 1 &&
             GameState.path.slice(1).some(p => p.x === start.x && p.y === start.y);
    }    
  };
  
  // =====================
  // Board Logic Namespace
  // =====================
  const BoardLogic = {
    // Create a random board of face cells
    generate() {
      GameState.board = Array.from({ length: GameState.gridSize }, () =>
        Array.from({ length: GameState.gridSize }, () => {
          const group = Math.floor(Math.random() * GameState.groups.length);
          const faceIndex = Math.floor(Math.random() * GameState.facesPerGroup);
          return { group, faceIndex, exploding: false };
        })
      );
    },
  
    // Resize canvas to fit viewport, and compute cellSize accordingly
    resizeCanvas() {
      const controlsHeight = document.getElementById('controls')?.offsetHeight || 0;
      const availableHeight = window.innerHeight - controlsHeight - 100;
      const availableWidth = window.innerWidth;
      const size = Math.min(availableWidth, availableHeight);
      GameState.canvas.width = GameState.canvas.height = size;
      GameState.cellSize = size / GameState.gridSize;
    },
  
    // Load all images from folder faceSet/groupX.jpg before continuing
    preloadFaceImages(callback) {
      let loaded = 0;
      for (let g = 0; g < GameState.groups.length; g++) {
        GameState.faceImages[g] = [];
        for (let i = 1; i <= GameState.facesPerGroup; i++) {
          const img = new Image();
          img.src = `images/${GameState.faceSet}/${GameState.groups[g]}${i}.jpg`;
          img.onload = () => {
            loaded++;
            if (loaded === GameState.groups.length * GameState.facesPerGroup) callback();
          };
          GameState.faceImages[g][i - 1] = img;
        }
      }
    },

    dropAll(callback) {
        GameState.fallingCells = [];
      
        for (let y = 0; y < GameState.gridSize; y++) {
          for (let x = 0; x < GameState.gridSize; x++) {
            const cell = GameState.board[y][x];
            if (cell) {
              GameState.fallingCells.push({
                x,
                fromY: -1,
                toY: y,
                cell
              });
            }
          }
        }
      
        Animation.animateFalling(callback);
    }, 
      
    createSolvableBoard() {
        const result = Hamiltonian.generate(GameState.gridSize, GameState.groups.length, GameState.facesPerGroup);
        if (!result) {
          console.warn("⚠️ Falling back to random board");
          BoardLogic.generate();
          BoardLogic.dropCells(() => Renderer.drawBoard());
          return;
        }
      
        GameState.board = result.hBoard;
        GameState.correctSolvablePath = result.hPath;
        BoardLogic.dropAll(() => {
          Renderer.drawBoard();
          UI.updateGameInfoVisibility();
        });
    },

    // =====================
    // Drop Logic
    // =====================
    dropCells(callback) {
        GameState.fallingCells = [];

        // By default, allow all groups
        let allowedGroups = GameState.groups.map((_, i) => i);
        if (!Utils.getLoopClosed() &&  GameState.path.length < 7 && GameState.visitedGroups.size < GameState.groups.length - 1) 
        { // If the path is short and it is not a loop, and there are at least two unvisited groups, allow all unvisited groups 
          allowedGroups = GameState.groups
            .map((_, i) => i) // all indices
            .filter(i => !GameState.visitedGroups.has(i));
        }
    
        for (let x = 0; x < GameState.gridSize; x++) {
        let pointer = GameState.gridSize - 1;
    
        for (let y = GameState.gridSize - 1; y >= 0; y--) {
            if (GameState.board[y][x]) {
            if (y !== pointer) {
                GameState.fallingCells.push({
                x,
                fromY: y,
                toY: pointer,
                cell: GameState.board[y][x]
                });
                GameState.board[pointer][x] = GameState.board[y][x];
                GameState.board[y][x] = null;
            }
            pointer--;
            }
        }
    
        for (let y = pointer; y >= 0; y--) {
            const group = allowedGroups[Math.floor(Math.random() * allowedGroups.length)];
            const faceIndex = Math.floor(Math.random() * GameState.facesPerGroup);
            const newCell = { group, faceIndex, exploding: false };
            GameState.board[y][x] = newCell;
            GameState.fallingCells.push({
            x,
            fromY: -1 - (pointer - y),
            toY: y,
            cell: newCell
            });
        }
        }
    
        Animation.animateFalling(callback);
    }
  };

  
  // =====================
// Path Logic Namespace
// =====================
const PathLogic = {
    // Reset current path and related state
    clear() {
        GameState.path = [];
        GameState.visitedGroups = new Set();
        GameState.currentGroup = null;
        GameState.lastDirection = null;

        UI.updateGameInfoVisibility();
    },
  
    // Start a new path at x,y
    startPath(x, y) {
      GameState.path = [{ x, y }];
      GameState.currentGroup = GameState.board[y][x].group;
      GameState.visitedGroups = new Set([GameState.currentGroup]);
      GameState.lastDirection = null;
    },
  
    // Extend the path by one cell
    addToPath(x, y, direction) {
      GameState.path.push({ x, y, direction });
      GameState.visitedGroups.add(GameState.board[y][x].group);
      GameState.currentGroup = GameState.board[y][x].group;
    },
  
    // Check whether user is backtracking (dragging to previous cell)
    isBacktracking(x, y) {
      if (GameState.path.length >= 2) {
        const prev = GameState.path[GameState.path.length - 2];
        return prev && prev.x === x && prev.y === y;
      }
      return false;
    },

    recomputeDeltaScores() {
        if (GameState.path.length === 0) return;
      
        GameState.path[0].deltaScore = 0;
      
        // -------- Loop Bonus Calculation --------
        let loopBonus = 0;
        if (Utils.getLoopClosed()) {
          for (let y = 0; y < GameState.gridSize; y++) {
            for (let x = 0; x < GameState.gridSize; x++) {
              const cell = GameState.board[y][x];
              if (cell && GameState.visitedGroups.has(cell.group)) {
                loopBonus += 1;
              }
            }
          }
        }
      
        // -------- Segment Tracking --------
        let segmentIndex = 0;       // Which straight segment we're in
        let segmentStep = 0;        // How many steps into the current segment
        let expectingNewStraight = true; // True after diagonal
      
        for (let i = 1; i < GameState.path.length; i++) {
          const prev = GameState.path[i - 1];
          const curr = GameState.path[i];
      
          const dx = curr.x - prev.x;
          const dy = curr.y - prev.y;
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);
      
          const isStraight = (dx === 0 || dy === 0) && (absDx + absDy === 1);
          const isDiagonal = absDx === 1 && absDy === 1;
      
          // Used for delta score label placement in Renderer
          curr.direction = isStraight
            ? (dx === 0 ? 'vertical' : 'horizontal')
            : (isDiagonal ? 'diagonal' : null);
      
          let deltaScore = 0;
      
          if (isStraight) {
            if (expectingNewStraight) {
              segmentIndex++;
              segmentStep = 1;
              expectingNewStraight = false;
            } else {
              segmentStep++;
            }
            deltaScore = segmentIndex * segmentStep;
          } else if (isDiagonal) {
            deltaScore = -1;
            expectingNewStraight = true;
            segmentStep = 0;
          } else {
            deltaScore = 0; // Shouldn't happen, defensive
          }
      
          // Add loop bonus to final step only
          if (Utils.getLoopClosed() && i === GameState.path.length - 1) {
            deltaScore += loopBonus;
          }
      
          curr.deltaScore = deltaScore;
        }
    }
           
  };
  
  // =====================
  // Renderer Namespace
  // =====================
  const Renderer = {
    // Draw the entire board
    drawBoard() {
      const ctx = GameState.ctx;
      ctx.clearRect(0, 0, GameState.canvas.width, GameState.canvas.height);
      for (let y = 0; y < GameState.gridSize; y++) {
        for (let x = 0; x < GameState.gridSize; x++) {
          const cell = GameState.board[y][x];
          if (!cell) continue;
          const scale = cell.exploding ? cell.scale || 1 : 1;
          const size = GameState.cellSize * 0.8 * scale;
          const img = GameState.faceImages[cell.group][cell.faceIndex];
          const px = x * GameState.cellSize + (GameState.cellSize - size) / 2;
          const py = y * GameState.cellSize + (GameState.cellSize - size) / 2;
          Renderer.drawRoundedImage(img, px, py, size, size);
        }
      }
      if (GameState.path.length > 1) {
        Renderer.drawPath();
        Renderer.drawTurnScore();
      }
      else {
        Renderer.drawTotalScore();
      }
    },
  
    // Draw path line connecting selected cells
    drawPath() {
      const ctx = GameState.ctx;
      const path = GameState.path;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000';
      ctx.beginPath();
      const start = path[0];
      ctx.moveTo(
        start.x * GameState.cellSize + GameState.cellSize / 2,
        start.y * GameState.cellSize + GameState.cellSize / 2
      );
      for (let i = 1; i < path.length; i++) {
        const p = path[i];
        ctx.lineTo(
          p.x * GameState.cellSize + GameState.cellSize / 2,
          p.y * GameState.cellSize + GameState.cellSize / 2
        );
        // Show the delta score on the path
        if (typeof p.deltaScore === 'number' && p.deltaScore !== 0) {
            ctx.fillStyle = 'black';
            ctx.font = `${GameState.cellSize * 0.15}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const prev = path[i - 1];
            const midX = (prev.x + p.x) * GameState.cellSize / 2 + GameState.cellSize / 2;
            const midY = (prev.y + p.y) * GameState.cellSize / 2 + GameState.cellSize / 2;
        
            let scoreX = midX;
            let scoreY = midY;
        
            if (p.direction == 'horizontal') scoreY -= 17;
            else if (p.direction == 'vertical') scoreX += 17;
            else if (p.direction == 'diagonal') scoreX += 21;
        
            ctx.fillText(
            (p.deltaScore > 0 ? '+' : '') + p.deltaScore,
            scoreX, scoreY
            );
        }
      }
      ctx.stroke();
    },
  
    // Show score either at the top or faded in the center
    drawTurnScore() {
      const ctx = GameState.ctx;
      GameState.turnScore = GameState.path.reduce((sum, p) => sum + (p.deltaScore || 0), 0);
      if (GameState.scoreDisplayMode === 'header') {
        const header = document.querySelector('h1');
        if (header) {
          if (GameState.path.length > 1) {
            header.textContent = `${GameState.turnScore}`;
          } else {
            header.textContent = `Total Score: ${GameState.totalScore}`;
          }
        }
      } else {
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = turnScore >= 0 ? 'green' : 'red';
        ctx.font = `${GameState.canvas.width * 0.67}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(turnScore, GameState.canvas.width / 2, GameState.canvas.height / 2);
        ctx.restore();
      }
    },

    drawTotalScore() {
        const header = document.querySelector('h1');
        if (header) header.textContent = `Total Score: ${GameState.totalScore}`;
    },

    // Draw a face image inside a circular mask
    drawRoundedImage(img, px, py, sizeX, sizeY) {
      const ctx = GameState.ctx;
      ctx.save();
      ctx.beginPath();
      ctx.arc(px + sizeX / 2, py + sizeY / 2, sizeX / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, px, py, sizeX, sizeY);
      ctx.restore();
    },

    drawBoardStaticParts() {
        const occupied = new Set(GameState.fallingCells.map(d => `${d.toY},${d.x}`));
      
        for (let y = 0; y < GameState.gridSize; y++) {
          for (let x = 0; x < GameState.gridSize; x++) {
            if (occupied.has(`${y},${x}`)) continue;
            const cell = GameState.board[y][x];
            if (!cell) continue;
            const img = GameState.faceImages[cell.group][cell.faceIndex];
            const size = GameState.cellSize * 0.8;
            this.drawRoundedImage(
              img,
              x * GameState.cellSize + (GameState.cellSize - size) / 2,
              y * GameState.cellSize + (GameState.cellSize - size) / 2,
              size,
              size
            );
          }
        }
      }      
  };

  // =====================
// Hamiltonian Namespace
// =====================
const Hamiltonian = {
    MAX_ATTEMPTS: 3,
    MAX_MILLIS: 500,
  
    generate(gridSize, numGroups, facesPerGroup) {
      console.log(`Generating Hamiltonian board: ${gridSize}x${gridSize}, groups: ${numGroups}`);
      const totalCells = gridSize * gridSize;
      const visited = Hamiltonian._createVisitedGrid(gridSize);
      const path = [];
      const directions = Hamiltonian._generateAllDirections();
  
      const success = Hamiltonian._generateLoop(path, visited, gridSize, totalCells, directions);
  
      if (!success) {
        console.warn("❌ Hamiltonian loop generation failed (max attempts or timeout)");
        return null;
      }
  
      const groups = Hamiltonian._assignGroups(path, numGroups);
      if (new Set(groups).size < numGroups) {
        console.warn("⚠️ Not all groups used. Found:", new Set(groups).size);
        return null;
      }
  
      const board = Hamiltonian._buildBoard(path, groups, gridSize, facesPerGroup);
      return { hBoard: board, hPath: path };
    },
  
    _createVisitedGrid(size) {
      return Array.from({ length: size }, () => Array(size).fill(false));
    },
  
    _generateAllDirections() {
      return [
        [0, 1], [1, 0], [0, -1], [-1, 0],     // straight
        [1, 1], [-1, -1], [1, -1], [-1, 1]    // diagonals
      ];
    },
  
    _generateLoop(path, visited, size, totalCells, directions) {
      const startTime = performance.now();
  
      for (let attempt = 0; attempt < Hamiltonian.MAX_ATTEMPTS; attempt++) {
        path.length = 0;
        visited.forEach(row => row.fill(false));
  
        const startX = Math.floor(Math.random() * size);
        const startY = Math.floor(Math.random() * size);
  
        try {
          if (dfs(startX, startY, 1)) {
            console.log("✔ Hamiltonian loop created");
            return true;
          }
        } catch (e) {
          if (e.message === "DFS timed out") return false;
          throw e;
        }
      }
  
      return false;
  
      function dfs(x, y, depth) {
        if (performance.now() - startTime > Hamiltonian.MAX_MILLIS) {
          throw new Error("DFS timed out");
        }
  
        path.push({ x, y });
        visited[y][x] = true;
  
        if (depth === totalCells) {
          const [sx, sy] = [path[0].x, path[0].y];
          const dx = sx - x;
          const dy = sy - y;
          if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0)) {
            path.push({ x: sx, y: sy }); // Close loop
            return true;
          }
          visited[y][x] = false;
          path.pop();
          return false;
        }
  
        const neighbors = sortNeighbors(x, y);
        for (const [nx, ny] of neighbors) {
          if (dfs(nx, ny, depth + 1)) return true;
        }
  
        visited[y][x] = false;
        path.pop();
        return false;
      }
  
      function sortNeighbors(x, y) {
        const options = [];
        for (const [dx, dy] of directions) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < size && ny < size && !visited[ny][nx]) {
            const onward = Hamiltonian._countUnvisitedNeighbors(nx, ny, visited, size);
            options.push([[nx, ny], onward]);
          }
        }
  
        // Warnsdorff's Rule: prioritize fewest onward moves
        options.sort((a, b) => {
          if (a[1] !== b[1]) return a[1] - b[1];
          const isDiagA = Math.abs(a[0][0] - x) === 1 && Math.abs(a[0][1] - y) === 1;
          const isDiagB = Math.abs(b[0][0] - x) === 1 && Math.abs(b[0][1] - y) === 1;
          return isDiagB - isDiagA;
        });
  
        return options.map(o => o[0]);
      }
    },
  
    _countUnvisitedNeighbors(x, y, visited, size) {
      let count = 0;
      for (const [dx, dy] of Hamiltonian._generateAllDirections()) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < size && ny < size && !visited[ny][nx]) {
          count++;
        }
      }
      return count;
    },
  
    _assignGroups(path, groupCount) {
      const pool = Array.from({ length: groupCount }, (_, i) => i);
      Utils.shuffleArray(pool);
      const groups = [];
      const unused = pool.slice(1);
      let current = pool[0];
      groups[0] = current;
  
      for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1];
        const curr = path[i];
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const isDiagonal = Math.abs(dx) === 1 && Math.abs(dy) === 1;
  
        if (isDiagonal) {
          current = unused.length > 0 ? unused.pop() : pool.filter(g => g !== current)[Math.floor(Math.random() * (groupCount - 1))];
        }
        groups[i] = current;
      }
  
      return groups;
    },
  
    _buildBoard(path, groupAssignments, size, facesPerGroup) {
      const board = Array.from({ length: size }, () => Array(size).fill(null));
      for (let i = 0; i < path.length; i++) {
        const { x, y } = path[i];
        board[y][x] = {
          group: groupAssignments[i],
          faceIndex: Math.floor(Math.random() * facesPerGroup),
          exploding: false
        };
      }
      return board;
    }
  };
  
  
  // =====================
  // Input Handlers
  // =====================
  const Handlers = {
    handleStart(evt) {
      const cell = Utils.getCellFromEvent(evt);
      if (!cell) return;
      const { x, y } = cell;
  
      const index = GameState.path.findIndex(p => p.x === x && p.y === y);
      if (index !== -1) {
        if (index === GameState.path.length - 1) {
          GameState.isMouseDown = true;
        } else {
          GameState.path = GameState.path.slice(0, index + 1);
          GameState.visitedGroups = new Set(GameState.path.map(p => GameState.board[p.y][p.x].group));
          GameState.currentGroup = GameState.board[y][x].group;
          GameState.lastDirection = null;
          GameState.isMouseDown = true;
        }
        Renderer.drawBoard();
        return;
      }
  
      PathLogic.startPath(x, y);
      GameState.isMouseDown = true;
      Renderer.drawBoard();
    },
  
    handleMove(evt) {
      if (!GameState.isMouseDown) return;
      const cell = Utils.getCellFromEvent(evt);
      if (!cell) return;
      const { x, y } = cell;
      if (!Utils.isInGrid(x, y)) return;
  
      if (PathLogic.isBacktracking(x, y)) {
        GameState.path.pop();
        const newLast = GameState.path[GameState.path.length - 1];
        GameState.currentGroup = GameState.board[newLast.y][newLast.x].group;
        GameState.visitedGroups = new Set(GameState.path.map(p => GameState.board[p.y][p.x].group));
        Renderer.drawBoard();
        return;
      }
  
      if (GameState.path.length === 0) return;
      const last = GameState.path[GameState.path.length - 1];
      if (last.x === x && last.y === y) return;
      if (Utils.getLoopClosed()) return;
  
      const dx = x - last.x;
      const dy = y - last.y;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx > 1 || absDy > 1) return;
  
      const isStraight = (dx === 0 || dy === 0) && (absDx + absDy === 1);
      const isDiagonal = absDx === 1 && absDy === 1;
      const nextGroup = GameState.board[y][x].group;
  
      if (isStraight && nextGroup !== GameState.currentGroup) return;
      if (isDiagonal && nextGroup === GameState.currentGroup) return;
      if (!isStraight && !isDiagonal) return;
  
      const isFirst = x === GameState.path[0].x && y === GameState.path[0].y;
      if (GameState.path.some(p => p.x === x && p.y === y) && !isFirst) return;
  
      const direction = isStraight ? (dx === 0 ? 'vertical' : 'horizontal') : 'diagonal';
      PathLogic.addToPath(x, y, direction);

      UI.updateGameInfoVisibility();
      
      PathLogic.recomputeDeltaScores();
      Renderer.drawBoard();
    },
  
    handleEnd(evt) {
      evt.preventDefault();
      GameState.isMouseDown = false;
      if (!GameState.manualSubmit) {
        Gameplay.submitCurrentPath();
      }
    }
  };
  
  // =====================
  // Gameplay Logic
  // =====================
  const Gameplay = {

    // =====================
    // Game Initialization
    // =====================
    init() {
        // Read settings from controls
        GameState.faceSet = document.getElementById('face-set').value;
        GameState.gridSize = parseInt(document.getElementById('grid-size').value);
        GameState.movesLeft = parseInt(document.getElementById('moves-limit').value);
        GameState.movesLimit = GameState.movesLeft;
        GameState.scoreDisplayMode = document.getElementById('score-overlay-toggle').value;
        const mode = document.getElementById('submit-mode').value;
        GameState.manualSubmit = (mode === 'manual');
    
        // Reset counters
        GameState.totalScore = 0;
        GameState.moves = 0;
        GameState.quit = false;
        GameState.gameOn = true;
    
        // Hide panels, show canvas
        document.getElementById('controls').style.display = 'none';
        document.getElementById('instructions').style.display = 'none';
        document.getElementById('game-container').style.display = 'block';
    
        const header = document.querySelector('h1');
        if (header) header.textContent = `Total Score: 0`;
    
        const setup = () => {
        BoardLogic.resizeCanvas();
        BoardLogic.generate();
        Renderer.drawBoard();
        UI.positionQuitButton();
        UI.updateInfo();
        UI.updateGameInfoVisibility();
    
        // Attach input handlers
        GameState.canvas.addEventListener('mousedown', Handlers.handleStart);
        GameState.canvas.addEventListener('mousemove', Handlers.handleMove);
        GameState.canvas.addEventListener('mouseup', Handlers.handleEnd);
        GameState.canvas.addEventListener('touchstart', Handlers.handleStart);
        GameState.canvas.addEventListener('touchmove', Handlers.handleMove);
        GameState.canvas.addEventListener('touchend', Handlers.handleEnd);
        };
    
        // Preload images, then setup
        if (GameState.faceSet !== 'none') {
        BoardLogic.preloadFaceImages(setup);
        } else {
        setup();
        }
    },

      // Process and finalize the current path
    submitCurrentPath() {
        if (GameState.path.length < 2) {
            PathLogic.clear();
            Renderer.drawBoard();
            return;
        }

        GameState.totalScore += GameState.turnScore; 

        let affected = [...GameState.path];
        if (Utils.getLoopClosed()) {
        affected = [];
        for (let y = 0; y < GameState.gridSize; y++) {
            for (let x = 0; x < GameState.gridSize; x++) {
            const cell = GameState.board[y][x];
            if (cell && GameState.visitedGroups.has(cell.group)) {
                affected.push({ x, y });
            }
            }
        }
        }

        for (const { x, y } of affected) {
            GameState.board[y][x] = null;
        }

        const solvable = (affected.length === GameState.gridSize * GameState.gridSize) && (GameState.visitedGroups.size == GameState.groups.length) && (GameState.gridSize < 8) && (GameState.path.length <= GameState.gridSize * GameState.gridSize / 2);
        Animation.animateRemoval(affected, solvable, (solvable) => {
          if (solvable) {
            BoardLogic.createSolvableBoard();
          } else {
            BoardLogic.dropCells(() => {
              Renderer.drawBoard();
              UI.updateGameInfoVisibility();
            });
          }
          PathLogic.clear(); // Always hide path immediately after animation
        });              
          
        GameState.moves++;
        GameState.movesLeft--;
        
        UI.updateInfo();
        UI.updateGameInfoVisibility();        
        
        if (GameState.movesLeft <= 0) {
          setTimeout(() => UI.endGame(), 1000);
        }        
    }
  };

  // =====================
// UI Namespace
// =====================
const UI = {

    updateGameInfoVisibility() {
        const submitBtn = document.getElementById('submit-path');
        const infoWrapper = document.getElementById('info-wrapper');
        const gameInfoRow = document.getElementById('game-info-row');
        const quitButton = document.getElementById('quit-button');
        const gameRow = document.getElementById('game-info-row');
        const canvas = GameState.canvas;
        const container = document.getElementById('game-container');
        const header = document.querySelector('h1');      

        if (!GameState.gameOn) {
            // Game is not active: hide all buttons and info and game.
            if (header) header.textContent = '';
            submitBtn.style.display = 'none';
            infoWrapper.style.display = 'none';
            gameInfoRow.style.display = 'none';
            quitButton.style.display = 'none';
            if (canvas) canvas.style.display = 'none';
            if (container) container.style.display = 'none';
            if (gameRow) gameRow.style.display = 'none';
            return;
        }
        else 
        {
            if (canvas) canvas.style.display = 'block';
            if (container) container.style.display = 'block';
            if (gameRow) gameRow.style.display = 'flex';

            if (!GameState.manualSubmit) {
                // Automatic mode: show info only
                submitBtn.style.display = 'none';
                infoWrapper.style.display = 'inline-block';
                gameInfoRow.style.display = 'flex';
                quitButton.style.display = 'inline-block'; // Show quit button in automatic mode
                return;
            }
            else {
                quitButton.style.display = 'inline-block'; // Show quit button in automatic mode
                // Manual mode
                if (GameState.path.length > 1) {
                    submitBtn.style.display = 'inline-block';
                    infoWrapper.style.display = 'none';
                    gameInfoRow.style.display = 'flex';
                } else {
                    submitBtn.style.display = 'none';
                    infoWrapper.style.display = 'inline-block';
                    gameInfoRow.style.display = 'flex';
                }
            }

            if (GameState.path.length < 2) {
                Renderer.drawTotalScore();
            }    
        }
        
    },

    updateInfo() {
        const movesEl = document.getElementById('moves-left');
        const meanEl = document.getElementById('mean-score');

        if (movesEl) {
            movesEl.textContent = GameState.movesLeft > 0
            ? `Moves left: ${GameState.movesLeft}`
            : '';
        }

        if (meanEl) {
            const mean = GameState.moves > 0
            ? (GameState.totalScore / GameState.moves).toFixed(2)
            : '0.00';
            meanEl.textContent = `Mean: ${mean}`;
        }
    },
      
    // Dynamically align quit button with canvas and header
    positionQuitButton() {
        const canvas = GameState.canvas;
        const h1 = document.querySelector('h1');
        const quitButton = document.getElementById('quit-button');

        if (!canvas || !h1 || !quitButton) return;

        const canvasRect = canvas.getBoundingClientRect();
        const h1Rect = h1.getBoundingClientRect();
        const parentRect = quitButton.offsetParent?.getBoundingClientRect() || { left: 0, top: 0 };

        const right = canvasRect.right - parentRect.left;
        const top = h1Rect.top - parentRect.top;

        quitButton.style.position = 'absolute';
        quitButton.style.left = `${right - quitButton.offsetWidth}px`;
        quitButton.style.top = `${top}px`;
    },

    showTopScores() {
        const grid = document.getElementById('score-grid-select').value;
        const moves = document.getElementById('score-moves-select').value;
        const scores = ScoreManager.load(grid, moves);
        const table = document.getElementById('score-table');
        const showMoves = moves === 'any';
      
        const headers = ['Total', 'Mean', ...(showMoves ? ['Moves'] : []), 'Date'];
        table.innerHTML = `
          <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>
            ${scores.map(s => `
              <tr>
                <td>${s.score}</td>
                <td>${s.mean.toFixed(2)}</td>
                ${showMoves ? `<td>${s.movesLimit}</td>` : ''}
                <td>${s.date || ''}</td>
              </tr>
            `).join('')}
          </tbody>
        `;
      
        if (scores.length === 0) {
          table.innerHTML = '<tr><td colspan="4" style="text-align:center">No scores yet.</td></tr>';
        }
    },

    updateMovesDropdown() {
        const grid = document.getElementById('score-grid-select').value;
        const movesSelect = document.getElementById('score-moves-select');
      
        const moveLimits = ScoreManager.getMoveLimits(grid);
        movesSelect.innerHTML = '<option value="any">Any</option>';
        moveLimits.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m;
          opt.textContent = m;
          movesSelect.appendChild(opt);
        });
     },
      
      // =====================
  // Score Dropdown UI
  // =====================
  populateScoreDropdowns() {
        const gridSelect = document.getElementById('score-grid-select');
        const movesSelect = document.getElementById('score-moves-select');
    
        if (!gridSelect || !movesSelect) return;
    
        // --- Populate grid dropdown ---
        const gridSizes = ScoreManager.getGridSizes();
        gridSelect.innerHTML = '';
        gridSizes.forEach(size => {
        const opt = document.createElement('option');
        opt.value = size;
        opt.textContent = size;
        if (size === GameState.lastSelectedGrid) opt.selected = true;
        gridSelect.appendChild(opt);
        });
    
        // Set default if no match
        if (!GameState.lastSelectedGrid && gridSizes.length > 0) {
        GameState.lastSelectedGrid = gridSizes[0];
        gridSelect.value = gridSizes[0];
        }
    
        // --- Populate moves dropdown based on selected grid ---
        const moveLimits = ScoreManager.getMoveLimits(GameState.lastSelectedGrid);
        movesSelect.innerHTML = '<option value="any">Any</option>';
        moveLimits.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        if (m === GameState.lastSelectedMoves) opt.selected = true;
        movesSelect.appendChild(opt);
        });
    
        // Set default if no match
        if (!GameState.lastSelectedMoves && moveLimits.length > 0) {
        GameState.lastSelectedMoves = 'any';
        movesSelect.value = 'any';
        }
    
        // --- Trigger score display update ---
        UI.showTopScores();
    },

    
    // Called when the game ends (moves run out or player quits)
    endGame() {
      GameState.gameOn = false;
  
      // Detach canvas interaction
      GameState.canvas.removeEventListener('mousedown', Handlers.handleStart);
      GameState.canvas.removeEventListener('mousemove', Handlers.handleMove);
      GameState.canvas.removeEventListener('mouseup', Handlers.handleEnd);
      GameState.canvas.removeEventListener('touchstart', Handlers.handleStart);
      GameState.canvas.removeEventListener('touchmove', Handlers.handleMove);
      GameState.canvas.removeEventListener('touchend', Handlers.handleEnd);
  
      // Show menu again
      document.getElementById('main-menu').style.display = 'flex';
      GameState.canvas.style.display = 'none';
      document.getElementById('game-container').style.display = 'none';
      document.getElementById('controls').style.removeProperty('display');
  
      if (!GameState.quit) {
        // Show final score screen
        document.getElementById('game-over').style.display = 'block';
        document.getElementById('final-score').textContent = GameState.totalScore;
        const mean = GameState.moves > 0 ? (GameState.totalScore / GameState.moves).toFixed(2) : '0';
        document.getElementById('final-mean-score').textContent = mean;

        ScoreManager.save(
            GameState.totalScore,
            GameState.gridSize,
            GameState.movesLimit, 
            parseFloat(mean)
        );
      }

      UI.updateGameInfoVisibility();
    }, 

    // Utility: Hide all overlays/panels
    hideAllPanels() {
        document.getElementById('settings-panel').style.display = 'none';
        document.getElementById('instructions').style.display = 'none';
        document.getElementById('high-scores').style.display = 'none';
        document.getElementById('confirm-delete').style.display = 'none';
        document.getElementById('quit-confirm').style.display = 'none';
        document.getElementById('game-over').style.display = 'none';
    }

  };
  
  
// =====================
// Animation Namespace
// =====================
const Animation = {
    // Animate removal of exploding cells and then call a callback
    animateRemoval(cells, solvable = false, onFinish = null) {
      for (const { x, y } of cells) {
        const cell = GameState.board[y][x];
        if (!cell) continue;
        cell.exploding = true;
        cell.scale = 1.0;
      }
  
      const totalFrames = 30;
      let frame = 0;
  
      function step() {
        for (const { x, y } of cells) {
          const cell = GameState.board[y][x];
          if (!cell || !cell.exploding) continue;
          cell.scale = 1 - frame / totalFrames;
          if (cell.scale < 0) cell.scale = 0;
        }
  
        Renderer.drawBoard();
        frame++;
  
        if (frame <= totalFrames) {
          requestAnimationFrame(step);
        } else {
          if (typeof onFinish === 'function') onFinish(solvable);
        }
      }
  
      requestAnimationFrame(step);
    },
  
    // Animate new cells falling into empty spots
    animateFalling(callback) {
      const duration = 300;
      const start = performance.now();
  
      function step(now) {
        let done = true;
        GameState.ctx.clearRect(0, 0, GameState.canvas.width, GameState.canvas.height);
        Renderer.drawBoardStaticParts();
  
        for (const d of GameState.fallingCells) {
          const progress = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          const y = d.fromY * GameState.cellSize + eased * (d.toY - d.fromY) * GameState.cellSize + GameState.cellSize / 2;
          const x = d.x * GameState.cellSize + GameState.cellSize / 2;
          const size = GameState.cellSize * 0.8;
          const img = GameState.faceImages[d.cell.group][d.cell.faceIndex];
          Renderer.drawRoundedImage(img, x - size / 2, y - size / 2, size, size);
          if (progress < 1) done = false;
        }
  
        if (!done) {
          requestAnimationFrame(step);
        } else {
          GameState.fallingCells = [];
          if (callback) callback();
        }
      }
  
      requestAnimationFrame(step);
    }
  };
    
 // =====================
// Score Manager
// =====================
const ScoreManager = {
    save(score, gridSize, movesLimit, mean) {
      const keyTotal = `scores_total_${gridSize}x${movesLimit}`;
      const keyMean = `scores_mean_${gridSize}`;
      const now = new Date().toISOString().split('T')[0];
  
      const newEntry = { score, gridSize, movesLimit, mean, date: now };
  
      // Total scores
      let totalScores = JSON.parse(localStorage.getItem(keyTotal)) || [];
      totalScores.push(newEntry);
      totalScores.sort((a, b) => b.score - a.score);
      localStorage.setItem(keyTotal, JSON.stringify(totalScores.slice(0, 10)));
  
      // Mean scores
      let meanScores = JSON.parse(localStorage.getItem(keyMean)) || [];
      meanScores.push(newEntry);
      meanScores.sort((a, b) => b.mean - a.mean);
      localStorage.setItem(keyMean, JSON.stringify(meanScores.slice(0, 10)));
    },
  
    getGridSizes() {
      const keys = Object.keys(localStorage);
      const sizes = new Set();
      keys.forEach(k => {
        const match = k.match(/^scores_total_(\d+)x/);
        if (match) sizes.add(match[1]);
      });
      return Array.from(sizes).sort((a, b) => a - b);
    },
  
    getMoveLimits(gridSize) {
      const keys = Object.keys(localStorage);
      const moves = new Set();
      keys.forEach(k => {
        const match = k.match(new RegExp(`^scores_total_${gridSize}x(\\d+)$`));
        if (match) moves.add(match[1]);
      });
      return Array.from(moves).sort((a, b) => a - b);
    },
  
    load(gridSize, moves) {
      if (moves === 'any') {
        return JSON.parse(localStorage.getItem(`scores_mean_${gridSize}`)) || [];
      } else {
        return JSON.parse(localStorage.getItem(`scores_total_${gridSize}x${moves}`)) || [];
      }
    }
  };
  
  // =====================
  // Settings Manager
  // =====================
  const SettingsManager = {
    save() {
      const settings = {
        faceSet: document.getElementById('face-set').value,
        gridSize: parseInt(document.getElementById('grid-size').value),
        movesLeft: parseInt(document.getElementById('moves-limit').value),
        scoreDisplayMode: document.getElementById('score-overlay-toggle').value,
        submitMode: document.getElementById('submit-mode').value
      };
      localStorage.setItem('savedSettings', JSON.stringify(settings));
    },
  
    load() {
      const saved = JSON.parse(localStorage.getItem('savedSettings'));
      if (!saved) return;
  
      document.getElementById('face-set').value = saved.faceSet || 'women';
      document.getElementById('grid-size').value = saved.gridSize || 5;
      document.getElementById('moves-limit').value = saved.movesLeft || 30;
      document.getElementById('score-overlay-toggle').value = saved.scoreDisplayMode || 'header';
      document.getElementById('submit-mode').value = saved.submitMode || 'auto';
    }
  };
  
  // Bind setting change listeners
  ['face-set', 'grid-size', 'moves-limit', 'score-overlay-toggle', 'submit-mode'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', SettingsManager.save);
  });
    
  // =====================
  // Delete and Quit Confirm
  // =====================
  document.getElementById('delete-scores')?.addEventListener('click', () => {
    document.getElementById('confirm-delete').style.display = 'flex';
  });
  
  document.getElementById('confirm-delete-yes')?.addEventListener('click', () => {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith('scores_')) localStorage.removeItem(k);
    });
    document.getElementById('confirm-delete').style.display = 'none';
    document.getElementById('high-scores').style.display = 'none';
    alert('Scores deleted.');
  });
  
  document.getElementById('confirm-delete-cancel')?.addEventListener('click', () => {
    document.getElementById('confirm-delete').style.display = 'none';
  });
  
  document.getElementById('quit-button')?.addEventListener('click', () => {
    document.getElementById('quit-confirm').style.display = 'flex';
  });
  
  document.getElementById('quit-yes')?.addEventListener('click', () => {
    document.getElementById('quit-confirm').style.display = 'none';
    GameState.quit = true;
    UI.endGame();
  });
  
  document.getElementById('quit-no')?.addEventListener('click', () => {
    document.getElementById('quit-confirm').style.display = 'none';
  });
  
  // =====================
// UI Panel Navigation
// =====================
  
  // PLAY button → start game
  document.querySelector('.play-btn')?.addEventListener('click', () => {
    UI.hideAllPanels();
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-over').style.display = 'none';
    Gameplay.init();
  });
  
  // SETTINGS button → open settings panel
  document.querySelector('.settings-btn')?.addEventListener('click', () => {
    UI.hideAllPanels();
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('settings-panel').style.display = 'flex';
  });
  
  // RULES button → show instructions
  document.querySelector('.rules-btn')?.addEventListener('click', () => {
    UI.hideAllPanels();
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('instructions').style.display = 'flex';
  });
  
  // SCORES button → open top score table
  document.querySelector('.scores-btn')?.addEventListener('click', () => {
    GameState.lastSelectedGrid = document.getElementById('score-grid-select').value;
    GameState.lastSelectedMoves = document.getElementById('score-moves-select').value;
    UI.hideAllPanels();
    document.getElementById('main-menu').style.display = 'none';
    UI.populateScoreDropdowns();
    UI.showTopScores();
    document.getElementById('high-scores').style.display = 'block';
  });
  
  // Close buttons (settings and rules)
  document.getElementById('close-settings-bottom')?.addEventListener('click', () => {
    document.getElementById('settings-panel').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
  });
  
  document.getElementById('close-rules')?.addEventListener('click', () => {
    document.getElementById('instructions').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
  });
  
  document.querySelector('.bottom-close')?.addEventListener('click', () => {
    UI.hideAllPanels();
    document.getElementById('main-menu').style.display = 'flex';
  });
  
  // Close buttons for scores panel
  document.getElementById('close-scores')?.addEventListener('click', () => {
    document.getElementById('high-scores').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
  });
  
  document.getElementById('close-scores-x')?.addEventListener('click', () => {
    document.getElementById('high-scores').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
  });

  document.getElementById('score-grid-select')?.addEventListener('change', () => {
    GameState.lastSelectedGrid = document.getElementById('score-grid-select').value;
    UI.updateMovesDropdown();
    UI.showTopScores();
  });
  
  document.getElementById('score-moves-select')?.addEventListener('change', () => {
    GameState.lastSelectedMoves = document.getElementById('score-moves-select').value;
    UI.showTopScores();
  });
  
  // =====================
  // Event Bindings
  // =====================
  
  // Play button
  document.querySelector('.play-btn').addEventListener('click', () => {
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('game-over').style.display = 'none';
    Gameplay.init();
  });
  
  // Submit (manual mode)
  document.getElementById('submit-path')?.addEventListener('click', () => {
    Gameplay.submitCurrentPath();
  });

  // =====================
  // Responsive Layout
  // =====================
  
  // Resize canvas on window change
  window.addEventListener('resize', () => {
    if (!GameState.canvas) return;
    BoardLogic.resizeCanvas();
    Renderer.drawBoard();
    UI.positionQuitButton();
  });
    
  // =====================
  // Restore Saved Settings
  // =====================
  SettingsManager.load(); // Immediately restore settings from localStorage on page load
  
  // Optional: show menu initially
  document.getElementById('main-menu').style.display = 'flex';
  