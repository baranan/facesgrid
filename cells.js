
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

let gameOn = false; // Track if the game is currently active
let quit = false; // Track if the game was quit
let manualSubmit = false;
let gridSize = 5;
let movesLeft = 0;
let total = 0;
let score = 0;
let moves = 0;
let cellSize;
let board = [];
let path = [];
let isMouseDown = false;
let currentGroup = null;
let visitedGroups = new Set();
let lastDirection = null;
let fallingCells = [];
let loopClosed = false;

let faceSet = 'none'; // Default face set
const groups = ['black', 'green', 'red', 'gray', 'yellow']; // Number of groups
const facesPerGroup = 4;
const faceImages = [];
let currentEliminatedGroups = [];

let lastSelectedGrid = null;
let lastSelectedMoves = null;

let correctSolvablePath = null;

function saveSettings() {
    const settings = {
      faceSet: document.getElementById('face-set').value,
      gridSize: parseInt(document.getElementById('grid-size').value),
      movesLeft: parseInt(document.getElementById('moves-limit').value),
      scoreDisplayMode: document.getElementById('score-overlay-toggle').value,
      submitMode: document.getElementById('submit-mode').value
    };
    localStorage.setItem('savedSettings', JSON.stringify(settings));
}
document.getElementById('face-set').addEventListener('change', saveSettings);
document.getElementById('grid-size').addEventListener('change', saveSettings);
document.getElementById('moves-limit').addEventListener('change', saveSettings);
document.getElementById('score-overlay-toggle').addEventListener('change', saveSettings);
document.getElementById('submit-mode').addEventListener('change', saveSettings);


function loadSavedSettings() {
    const saved = JSON.parse(localStorage.getItem('savedSettings'));
    if (!saved) return;
  
    document.getElementById('face-set').value = saved.faceSet || 'women';
    document.getElementById('grid-size').value = saved.gridSize || 5;
    document.getElementById('moves-limit').value = saved.movesLeft || 30;
    document.getElementById('score-overlay-toggle').value = saved.scoreDisplayMode || 'header';
    document.getElementById('submit-mode').value = saved.submitMode || 'auto';
}
  
// Preload face images
function preloadFaceImages(callback) {
    let loaded = 0;
    for (let g = 0; g < groups.length; g++) {
        faceImages[g] = [];
        for (let i = 1; i <= facesPerGroup; i++) {
            const img = new Image();
            img.src = `images/${faceSet}/${groups[g]}${i}.jpg`;;
            img.onload = () => {
                loaded++;
                if (loaded === groups.length * facesPerGroup) callback();
            };
            faceImages[g][i-1] = img;
        }
    }
}

function startGame1() {
    gameOn = true; // Set gameOn to true to allow game actions
    score = 0; 
    quit = false; // Reset quit state

    let newFaceSet = document.getElementById('face-set').value;
    gridSize = parseInt(document.getElementById('grid-size').value);
    movesLeft = parseInt(document.getElementById('moves-limit').value);
    movesLeftOriginal = movesLeft; // Store original moves limit for later use
    scoreDisplayMode = document.getElementById('score-overlay-toggle').value;
    const mode = document.getElementById('submit-mode').value;
    manualSubmit = (mode === 'manual');

    document.getElementById('controls').style.display = 'none';
    document.getElementById('instructions').style.display = 'none';
    document.getElementById('game-container').style.display = 'block';
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('high-scores').style.display = 'none';

    updateGameInfoVisibility();
    
    const container = document.getElementById('game-container');
    canvas.style.display = 'block'; // restore canvas if hidden

    const header = document.querySelector('h1');
    if (header) {
        header.textContent = `Total Score: ${score}`;
    }

    if (newFaceSet !== faceSet) {
        faceSet = newFaceSet;
        preloadFaceImages(startGame2);
    }
    else {
        startGame2();
    }

}

function startGame2() {
    total = 0;
    score = 0;
    moves = 0;
    path = [];
    visitedGroups = new Set();

    resizeCanvas();
    generateBoard();
    updateInfo();
    drawBoard();
    positionQuitButton();

    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('touchstart', handleStart);
    canvas.addEventListener('touchmove', handleMove);
    canvas.addEventListener('touchend', handleEnd);
}

function resizeCanvas() {
    const controlsHeight = document.getElementById('controls').offsetHeight;
    const availableHeight = window.innerHeight - controlsHeight - 100; // adjust 100 if needed
    const availableWidth = window.innerWidth;
    const size = Math.min(availableWidth, availableHeight);
    canvas.width = canvas.height = size;
    cellSize = canvas.width / gridSize;
}

function generateBoard() {
    board = Array.from({ length: gridSize }, () =>
        Array.from({ length: gridSize }, () => {
            const group = Math.floor(Math.random() * groups.length);
            const faceIndex = Math.floor(Math.random() * facesPerGroup);
            return { group, faceIndex, exploding: false };
        })
    );
}

// Draw the path with a line and show the delta score
function drawPath() {
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    const start = path[0];
    ctx.moveTo(start.x * cellSize + cellSize / 2, start.y * cellSize + cellSize / 2);
    for (let i = 1; i < path.length; i++) {
        const p = path[i];
        ctx.lineTo(p.x * cellSize + cellSize / 2, p.y * cellSize + cellSize / 2);
        // Show the delta score on the path
        if (typeof p.deltaScore === 'number' && p.deltaScore !== 0) {
            ctx.fillStyle = 'black';
            ctx.font = `${cellSize * 0.15}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const prev = path[i - 1];
            const midX = (prev.x + p.x) * cellSize / 2 + cellSize / 2;
            const midY = (prev.y + p.y) * cellSize / 2 + cellSize / 2;

            // Offset the text slightly to avoid overlapping the line
            let scoreX = midX;
            let scoreY = midY;

            if (p.direction == 'horizontal') {
                scoreY -= 17; // Offset for horizontal
            }
            else if (p.direction == 'vertical') {
                scoreX += 17; // Offset for vertical
            }
            else if (p.direction == 'diagonal') {
                scoreX += 21; // Offset for diagonal
            }

            ctx.fillText(
                (p.deltaScore > 0 ? '+' : '') + p.deltaScore,
                scoreX, scoreY
            );
        }
    }

    ctx.stroke();
}


// Draw the total score
function drawTotalScore() {
    const totalScore = path.reduce((sum, p) => sum + (p.deltaScore || 0), 0);

    if (scoreDisplayMode === 'header') {
        const header = document.querySelector('h1');
        if (header) {
            header.textContent = `${totalScore}`;
        }
    } else {
        ctx.save();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = totalScore >= 0 ? 'green' : 'red';
        ctx.font = `${canvas.width * 0.67}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            totalScore,
            canvas.width / 2,
            canvas.height / 2
        );
        ctx.restore();
    }
}



// Draw the game board
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            const cell = board[y][x];
            if (!cell) continue;

            const scale = cell.exploding ? cell.scale || 1 : 1;
            const size = (cellSize * 0.8) * scale;
            const img = faceImages[cell.group][cell.faceIndex];
            const px = x * cellSize + (cellSize - size) / 2;
            const py = y * cellSize + (cellSize - size) / 2;

            if (path.some(p => p.x === x && p.y === y)) {
                // Apply shadow and dark overlay to selected cells
                ctx.save();
                ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
                ctx.shadowBlur = 10;
                drawRoundedImage(img, px, py, size, size);
                
                // Dark overlay
                ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
                ctx.beginPath();
                ctx.arc(px + size / 2, py + size / 2, size / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            } else {
                drawRoundedImage(img, px, py, size, size);
            }
        }
    }

    if (path.length > 1) {
        drawPath();  
        drawTotalScore(); // Draw the total score
    }
}

function getCellFromEvent(evt) {
    const rect = canvas.getBoundingClientRect();
    const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const offsetX = (clientX - rect.left) * scaleX;
    const offsetY = (clientY - rect.top) * scaleY;
    
    const x = Math.floor(offsetX / cellSize);
    const y = Math.floor(offsetY / cellSize);

    // Calculate the fractional position within the cell
    const fracX = (offsetX % cellSize) / cellSize;
    const fracY = (offsetY % cellSize) / cellSize;

    // Only return the cell if the pointer is at least 20% into it (both directions)
    if (fracX > 0.2 && fracX < 0.8 && fracY > 0.2 && fracY < 0.8) {
        return { x, y };
    } else {
        return null; // Pointer is not sufficiently inside the cell
    }
}

function isInGrid(x, y) {
    return x >= 0 && y >= 0 && x < gridSize && y < gridSize;
}

function handleStart(evt) {
    const cell = getCellFromEvent(evt);
    if (!cell) return;
    
    const { x, y } = cell;
    
    const clickedIndex = path.findIndex(p => p.x === x && p.y === y);
    
    if (clickedIndex !== -1) {
        // Cell is in path
        if (clickedIndex === path.length - 1) {
            // Rejoin at end – continue path
            isMouseDown = true;
        } else {
            // Backtrack to clickedIndex
            path = path.slice(0, clickedIndex + 1);
            visitedGroups = new Set(path.map(p => board[p.y][p.x].group));
            currentGroup = board[y][x].group;
            loopClosed = false;
            lastDirection = null;
            isMouseDown = true;
        }
        drawBoard();
        updateGameInfoVisibility();
        return;
    }
    
    // Not in current path – start new path
    path = [{ x, y }];
    visitedGroups = new Set([board[y][x].group]);
    currentGroup = board[y][x].group;
    loopClosed = false;
    lastDirection = null;
    isMouseDown = true;
    
    drawBoard();
    updateGameInfoVisibility();    
}

function recomputeDeltaScoresForPath() {
    if (path.length === 0) return;

    // First cell doesn't represent a move
    path[0].deltaScore = 0;

    // -------- Loop Bonus Calculation --------
    let loopBonus = 0;
    updateLoopClosed();
    if (loopClosed) {
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const cell = board[y][x];
                if (cell && visitedGroups.has(cell.group)) {
                    loopBonus += 1;
                }
            }
        }
    }
    
    // -------- Segment Tracking --------
    let segmentIndex = 0;       // 0 means we haven't started any straight segment yet
    let segmentStep = 0;        // How many moves within the current straight segment
    let expectingNewStraight = true; // True after a diagonal move

    for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1];
        const curr = path[i];

        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        const isStraight = (dx === 0 || dy === 0) && (absDx + absDy === 1);
        const isDiagonal = absDx === 1 && absDy === 1;

        // Direction is used for visual offset in drawPath()
        curr.direction = isStraight
            ? (dx === 0 ? 'vertical' : 'horizontal')
            : (isDiagonal ? 'diagonal' : null);

        let deltaScore = 0;

        if (isStraight) {
            if (expectingNewStraight) {
                // Only now do we start a new segment
                segmentIndex++;
                segmentStep = 1; // First step in the new segment
                expectingNewStraight = false;
            } else {
                segmentStep++; // Continuing current segment
            }

            // Arithmetic series step: base × step
            deltaScore = segmentIndex * segmentStep;
        }
        else if (isDiagonal) {
            // Diagonals interrupt straight segments
            deltaScore = -1;
            expectingNewStraight = true; // Next straight move will start a new segment
            segmentStep = 0; // Reset step count
        }
        else {
            // Should not happen unless invalid move
            deltaScore = 0;
        }

        // Loop bonus only applies to the last step
        if (loopClosed && i === path.length - 1) {
            deltaScore += loopBonus;
        }

        curr.deltaScore = deltaScore;
    }
}

function updateLoopClosed() {
    // Loop is closed if the first cell appears again in the path
    const start = path[0];
    loopClosed = path.slice(1).some(p => p.x === start.x && p.y === start.y);
}

function handleMove(evt) {
    if (!isMouseDown) return; // Moving only as long as mouse is down

    // Get the current cell from the event
    const cell = getCellFromEvent(evt);
    if (!cell) return;    
    const { x, y } = cell;
    
    if (!isInGrid(x, y)) return;

    // Handle backtracking
    let backtracking = false;
    if (path.length >= 2) {
        const prev = path[path.length - 2];
        if (prev && prev.x === x && prev.y === y) {
            backtracking = true;
        }
    }    

    if (backtracking) {
        path.pop(); // remove last step
        const newLast = path[path.length - 1];
        currentGroup = board[newLast.y][newLast.x].group;

        // Recompute visited groups from current path
        visitedGroups = new Set(path.map(p => board[p.y][p.x].group));

        // Recompute last direction based on new last step
        lastDirection = path.length >= 2 ? path[path.length - 1].direction : null;

        // Recompute loopClosed: true if starting point appears again
        updateLoopClosed();

        drawBoard();
        updateGameInfoVisibility();
        return;
    }

    // Check if this is the same cell as the last one
    if (path.length === 0) return; // No moves allowed if path is empty
    const last = path[path.length - 1];
    if (last.x === x && last.y === y) return;

    if (loopClosed) return; // No moves allowed after closing the loop

    // Compute the difference in x and y coordinates
    const dx = x - last.x;
    const dy = y - last.y;
    // Compute the absolute values of dx and dy
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // ❌ Reject moves that aren't directly adjacent
    if (absDx > 1 || absDy > 1) return;

    const isStraight = (dx === 0 || dy === 0) && (absDx + absDy === 1);
    const isDiagonal = absDx === 1 && absDy === 1;

    const nextGroup = board[y][x].group;
    let direction = null;

    if (isStraight) {
        if (nextGroup !== currentGroup) return;

        direction = dx === 0 ? 'vertical' : 'horizontal';

        // ✅ Allow switching between vertical/horizontal as long as it's the same group
        lastDirection = direction;

    } else if (isDiagonal) {
        if (nextGroup === currentGroup) return;

        currentGroup = nextGroup;
        visitedGroups.add(currentGroup);
        direction = 'diagonal';

        // Reset direction after a diagonal
        lastDirection = null;
    } else {
        return; // invalid move
    }

    const isFirst = x === path[0].x && y === path[0].y;
    // Cannot return to the same cell unless it's the first one
    if (path.some(p => p.x === x && p.y === y) && !isFirst) return;

    updateLoopClosed();

    path.push({ x, y, direction });
    recomputeDeltaScoresForPath(); // 🔁 Recompute all deltaScores
    drawBoard();
    updateGameInfoVisibility();
      
    return;
}

function submitCurrentPath() {
    updateGameInfoVisibility();

    if (path.length < 2) {
        path = [];
        document.querySelector('h1').textContent = `Total Score: ${score}`;
        drawBoard();
        return;
    }

    updateLoopClosed();

    let affected = [...path];

    currentEliminatedGroups = [...visitedGroups];
    if (loopClosed) {
        affected = [];
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const cell = board[y][x];
                if (cell && visitedGroups.has(cell.group)) {
                    affected.push({ x, y });
                }
            }
        }
    }

    let scoreBonus = path.reduce((sum, p) => sum + (p.deltaScore || 0), 0);
    score += scoreBonus;

    // Remove elimenated and replace them. 
    animateRemoval(affected, (affected.length === gridSize * gridSize && gridSize < 8), handleAfterRemoval);

    moves++;
    total += affected.length;
    movesLeft--;

    updateInfo();
    path = [];
    visitedGroups = new Set();

    const header = document.querySelector('h1');
    if (header) {
        header.textContent = `Total Score: ${score}`;
    }

    updateGameInfoVisibility();
    
    if (movesLeft <= 0) setTimeout(endGame, 1000);
}

function handleEnd(evt) {
    evt.preventDefault();
    isMouseDown = false;

    if (manualSubmit) return;
    submitCurrentPath();
}

/**
 * Animates the removal of cells and then calls a follow-up function.
 * 
 * @param {Array} cells - Array of objects with {x, y} indicating which cells to animate/remove.
 * @param {boolean} solvable - If true, generate a fully solvable board after animation.
 * @param {Function} onFinish - Function to run after the animation ends. It receives (solvable) as argument.
 */
function animateRemoval(cells, solvable = false, onFinish = null) {
    // Step 1: Mark all target cells as "exploding" and initialize animation scale
    for (const { x, y } of cells) {
      const cell = board[y][x];
      if (!cell) continue;            // Skip if cell already null
      cell.exploding = true;          // Flag this cell for visual explosion
      cell.scale = 1.0;               // Start scale for shrinking animation
    }
  
    const totalFrames = 30;           // Number of animation frames (~0.5s at 60fps)
    let frame = 0;                    // Current frame index
  
    /**
     * Internal function: executes one frame of the explosion animation,
     * shrinking each marked cell and redrawing the board.
     */
    function step() {
      // Step 2: Update cell scale for all exploding cells
      for (const { x, y } of cells) {
        const cell = board[y][x];
        if (!cell || !cell.exploding) continue;
        cell.scale = 1 - frame / totalFrames;      // Gradually shrink cell
        if (cell.scale < 0) cell.scale = 0;        // Clamp scale to 0
      }
  
      // Step 3: Redraw board to reflect updated cell states
      drawBoard();
      frame++;
  
      // Step 4: Schedule next animation frame or finalize when done
      if (frame <= totalFrames) {
        // Not done yet: schedule next frame
        requestAnimationFrame(step);
      } else {
        // Animation complete: pass control to the caller
        if (typeof onFinish === 'function') {
          onFinish(solvable);       // Caller decides what to do next
        }
      }
    }
  
    // Start animation loop
    step();
  }
  
  function handleAfterRemoval(solvable) {
    if (solvable) {
      createSolvableBoard(); // 🎯 full-board-generation path
    } else {
      // Normal behavior: clear removed cells and drop new ones
      for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
          if (!board[y][x] || board[y][x].exploding) {
            board[y][x] = null;
          }
        }
      }
      dropCells(() => drawBoard());
    }
  }
  

// Drop cells down to fill empty spaces
function dropCells(callback) {
    fallingCells = [];

    // Determine which groups are allowed for newly generated faces
    // 
    let allowedGroups;
    if (!loopClosed && currentEliminatedGroups.length < groups.length - 1) {
        // If at least two groups were not eliminated and those who were eliminated were probably not completely eliminated because no loop closed: allow only the remaining groups
        allowedGroups = [...Array(groups.length).keys()].filter(g => !currentEliminatedGroups.includes(g));
    } else {
        // If too many groups were eliminated: allow all groups
        allowedGroups = [...Array(groups.length).keys()];
    }

    // Loop through each column to simulate gravity
    for (let x = 0; x < gridSize; x++) {
        let pointer = gridSize - 1; // Pointer to where the next occupied cell should go

        // Move all existing cells down to fill empty spaces
        for (let y = gridSize - 1; y >= 0; y--) { // This runs from bottom to top
            if (board[y][x]) {
                if (y !== pointer) {  // If this is not the pointer, then it means that there was an empty cell below it.
                    // Schedule the cell to fall
                    fallingCells.push({
                        x,
                        fromY: y,
                        toY: pointer,
                        cell: board[y][x],
                        yPos: y * cellSize
                    });

                    // Move the cell to the lower position
                    board[pointer][x] = board[y][x];
                    board[y][x] = null;
                }
                pointer--;
            }
        }

        // Add new cells at the top to fill any remaining spaces in the column
        for (let y = pointer; y >= 0; y--) {
            const group = allowedGroups[Math.floor(Math.random() * allowedGroups.length)];
            const faceIndex = Math.floor(Math.random() * facesPerGroup);
            const newCell = { group, faceIndex, exploding: false };
            board[y][x] = newCell;

            // Schedule the new cell to fall from above the visible canvas
            fallingCells.push({
                x,
                fromY: -1 - (pointer - y), // Start above canvas
                toY: y,
                cell: newCell,
                yPos: -1 * cellSize
            });
        }
    }

    // Animate all scheduled falling cells
    animateFalling(callback);
}

function animateFalling(callback) {
    const duration = 300; // Total duration of the animation in milliseconds
    const start = performance.now(); // Timestamp when the animation starts

    // Step function called on each animation frame
    function step(now) {
        let done = true; // Flag to check if all cells have finished falling

        // Clear the canvas for redrawing
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw all the cells that are not currently falling
        drawStaticBoard();

        // Animate each falling cell
        for (const d of fallingCells) {
            // Compute the progress of the animation (from 0 to 1)
            const progress = Math.min(1, (now - start) / duration);

            // Apply easing (ease-out cubic) to smooth the falling motion
            const eased = 1 - Math.pow(1 - progress, 3);

            // Compute the current y-position of the falling cell
            const y = d.fromY * cellSize + eased * (d.toY - d.fromY) * cellSize + cellSize / 2;

            // Compute the x-position (fixed based on column)
            const x = d.x * cellSize + cellSize / 2;

            // Size of the cell image
            const size = cellSize * 0.8;

            // Get the appropriate face image for the cell
            const img = faceImages[d.cell.group][d.cell.faceIndex];

            // Draw the cell at its current falling position
            drawRoundedImage(img, x - size / 2, y - size / 2, size, size);

            // If animation isn't finished for this cell, mark done as false
            if (progress < 1) done = false;
        }

        // If any cells are still falling, request another animation frame
        if (!done) {
            requestAnimationFrame(step);
        } else {
            // All falling is done: clear the list and call the callback (e.g., redraw board)
            fallingCells = [];
            callback();
        }
    }

    // Kick off the first animation frame
    requestAnimationFrame(step);
}

function drawRoundedImage(img, px, py, size) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(px + size / 2, py + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, px, py, size, size);
  ctx.restore();
}

function drawStaticBoard() {
    const occupied = new Set(fallingCells.map(d => `${d.toY},${d.x}`));

    for (let y = 0; y < gridSize; y++) {
        for (let x = 0; x < gridSize; x++) {
            if (occupied.has(`${y},${x}`)) continue;
            const cell = board[y][x];
            if (!cell) continue;
            const img = faceImages[cell.group][cell.faceIndex];
            const size = cellSize * 0.8;
            drawRoundedImage(img, x * cellSize + (cellSize - size) / 2, y * cellSize + (cellSize - size) / 2, size, size);
        }
    }
}

function updateInfo() {
    document.getElementById('moves-left').textContent = movesLeft > 0 ? `Moves Left: ${movesLeft}` : '';
    //document.getElementById('score').textContent = `Score: ${score}`;
    const mean = moves > 0 ? (score / moves).toFixed(2) : '0';
    document.getElementById('mean-score').textContent = `Mean Score: ${mean}`;
}

function saveHighScores(score, gridSize, movesLimit, mean) {
    const keyTotal = `scores_total_${gridSize}x${movesLimit}`;
    const keyMean = `scores_mean_${gridSize}`;
    const now = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const newEntry = { score, gridSize, movesLimit, mean, date: now };

    // ---- Save total scores ----
    let topTotal = JSON.parse(localStorage.getItem(keyTotal)) || [];
    topTotal.push(newEntry);
    topTotal.sort((a, b) => b.score - a.score);
    topTotal = topTotal.slice(0, 10);
    localStorage.setItem(keyTotal, JSON.stringify(topTotal));

    // ---- Save mean scores ----
    let topMean = JSON.parse(localStorage.getItem(keyMean)) || [];
    topMean.push(newEntry);
    topMean.sort((a, b) => b.mean - a.mean);
    topMean = topMean.slice(0, 10);
    localStorage.setItem(keyMean, JSON.stringify(topMean));
}

    // Main function to generate a hBoard that can be fully eliminated in one loop
    function generateFullyEliminatableBoard(gridSize, numGroups, facesPerGroup) {
        console.log("Generating Hamiltonian board with size:", gridSize, "and groups:", numGroups);
        const size = gridSize;
        const totalCells = size * size;
        const visited = createVisitedGrid(size);
        const hPath = [];
    
        const directions = generateAllDirections(); // 8-way movement
    
        // Step 1: Generate a Hamiltonian loop (visits all cells, ends where it started)
        const success = generateHamiltonianLoop(hPath, visited, size, totalCells, directions);
    
        if (!success) {
            console.warn("❌ Hamiltonian loop generation failed (max attempts reached)");
            return null;
        }
    
        // Step 2: Assign groups along the hPath, respecting movement constraints
        const groupAssignments = assignGroupsTohPath(hPath, numGroups);
    
        // Step 3: Check if all group indices were used
        const usedGroups = new Set(groupAssignments);
        if (usedGroups.size < numGroups) {
            console.warn("⚠️ Not all groups were used. Found:", usedGroups.size, "Expected:", numGroups);
            return null;
        }

        // Step 4: Build the board
        const hBoard = applyhPathTohBoard(hPath, groupAssignments, size, facesPerGroup);
        console.log("✔ Generated Hamiltonian board with all groups:", hBoard);
        
        return { hBoard, hPath};
    
  };

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }  
  
  // Helper: Create a 2D visited grid
  function createVisitedGrid(size) {
    return Array.from({ length: size }, () => Array(size).fill(false));
  }
  
  // Helper: Return 8 possible directions (4 straight, 4 diagonal)
  function generateAllDirections() {
    return [
      [0, 1], [1, 0], [0, -1], [-1, 0], // straight
      [1, 1], [-1, -1], [1, -1], [-1, 1] // diagonal
    ];
  }
  
  // Helper: Generate a Hamiltonian loop using DFS
  function generateHamiltonianLoop(hPath, visited, size, totalCells, directions) {
    // Try repeatedly with random start points until successful
    const MAX_ATTEMPTS = 3;
    const MAX_MILLIS = 500; // maximum time to find Hamiltonian loop in milliseconds
    const startTime = performance.now();

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        console.log(`Attempt ${attempt + 1} to generate Hamiltonian loop...`);
        // Reset hPath and visited grid
        hPath.length = 0;
        for (let row of visited) row.fill(false);

        const startX = Math.floor(Math.random() * size);
        const startY = Math.floor(Math.random() * size);

        try {
            if (dfs(startX, startY, 1)) {
                console.log("✔ Hamiltonian loop found in time");
                return true;
            }
            } catch (e) {
            if (e.message === "DFS timed out") {
                console.warn("❌ generateHamiltonianLoop aborted (DFS timed out)");
                return false;
            }
            throw e; // unexpected error
        }
    }
  
    // Give up after too many tries
    return false;
  
    // ----- Recursive Depth-First Search -----
    function dfs(x, y, depth) {
        // 💣 Abort early if we've exceeded the allowed time
        if (performance.now() - startTime > MAX_MILLIS) {
          throw new Error("DFS timed out"); // Let the loop above catch it
        }
      
        hPath.push({ x, y });
        visited[y][x] = true;
      
        if (depth === totalCells) {
          const first = hPath[0];
          const dx = first.x - x;
          const dy = first.y - y;
          const canCloseLoop =
            Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx !== 0 || dy !== 0);
          if (canCloseLoop) {
            hPath.push({ x: first.x, y: first.y });
            return true;
          } else {
            visited[y][x] = false;
            hPath.pop();
            return false;
          }
        }
      
        const neighbors = getAvailableNeighborsSorted(x, y);
        for (const [nx, ny] of neighbors) {
          if (dfs(nx, ny, depth + 1)) return true;
        }
      
        visited[y][x] = false;
        hPath.pop();
        return false;
    }
      
  
    // ----- Heuristic: Sort neighbors by how "trapped" they are -----
    function getAvailableNeighborsSorted(x, y) {
      const options = [];
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < size && ny < size && !visited[ny][nx]) {
          const onward = countUnvisitedNeighbors(nx, ny);
          options.push([[nx, ny], onward]);
        }
      }
  
      // Sort by fewest onward moves (Warnsdorff’s Rule)
      options.sort((a, b) => {
        // First compare by onward options
        if (a[1] !== b[1]) return a[1] - b[1];
      
        // If tied, prefer diagonal
        const [ax, ay] = a[0];
        const [bx, by] = b[0];
        const isDiagonalA = Math.abs(ax - x) === 1 && Math.abs(ay - y) === 1;
        const isDiagonalB = Math.abs(bx - x) === 1 && Math.abs(by - y) === 1;
      
        return isDiagonalB - isDiagonalA; // Prefer diagonals
      });
      return options.map(o => o[0]);
    }
  
    // Count how many unvisited neighbors a cell has (used for sorting)
    function countUnvisitedNeighbors(x, y) {
      let count = 0;
      for (const [dx, dy] of directions) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < size && ny < size && !visited[ny][nx]) {
          count++;
        }
      }
      return count;
    }
  }
  
  
  // Helper: Assign a group to each cell in the hPath, following movement rules
function assignGroupsTohPath(hPath, groupSize) {
    const groupPool = Array.from({ length: groupSize }, (_, i) => i);
    shuffleArray(groupPool); // Randomize group pool
  
    const groupAssignments = [];
    const usedGroups = new Set();
  
    // Start with the first group
    let currentGroup = groupPool[0];
    groupAssignments[0] = currentGroup;
    usedGroups.add(currentGroup);
  
    // Track unused groups (for diversity)
    const unusedGroups = groupPool.slice(1);
  
    // Iterate through the hPath and assign groups based on movement
    for (let i = 1; i < hPath.length; i++) {
      const prev = hPath[i - 1];
      const curr = hPath[i];
  
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const isDiagonal = Math.abs(dx) === 1 && Math.abs(dy) === 1;
  
      if (isDiagonal) {
        let newGroup;
  
        // Prefer unused groups for more diversity
        if (unusedGroups.length > 0) {
          newGroup = unusedGroups.pop();
        } else {
          // Fallback to a different group than current
          const candidates = groupPool.filter(g => g !== currentGroup);
          newGroup = candidates[Math.floor(Math.random() * candidates.length)];
        }
  
        currentGroup = newGroup;
        usedGroups.add(currentGroup);
      }
  
      groupAssignments[i] = currentGroup;
    }
  
    return groupAssignments;
}

  // Helper: Populate the global hBoard using the hPath and group values
function applyhPathTohBoard(hPath, groupAssignments, size, facesPerGroup) {
    hBoard = Array.from({ length: size }, () => Array(size).fill(null));
  
    for (let i = 0; i < hPath.length; i++) {
      const { x, y } = hPath[i];
      hBoard[y][x] = {
        group: groupAssignments[i],
        faceIndex: Math.floor(Math.random() * facesPerGroup),
        exploding: false
      };
    }

    return hBoard;
  }

function endGame() {

    gameOn = false; // Set gameOn to false to prevent further actions

    canvas.removeEventListener('mousedown', handleStart);
    canvas.removeEventListener('mousemove', handleMove);
    canvas.removeEventListener('mouseup', handleEnd);
    canvas.removeEventListener('touchstart', handleStart);
    canvas.removeEventListener('touchmove', handleMove);
    canvas.removeEventListener('touchend', handleEnd);
    

    document.getElementById('main-menu').style.display = 'flex';
    canvas.style.display = 'none';

    updateGameInfoVisibility();

    document.querySelector('h1').textContent = '';

    document.getElementById('game-container').style.display = 'none';

    //document.getElementById('controls').style.display = 'block';
    document.getElementById('controls').style.removeProperty('display');

    if (!quit) {       
        document.getElementById('game-over').style.display = 'block';
        document.getElementById('final-score').textContent = score;
        const mean = moves > 0 ? (score / moves).toFixed(2) : '0';
        document.getElementById('final-mean-score').textContent = mean;

        saveHighScores(score, gridSize, movesLeftOriginal, parseFloat(mean));
    }
}

document.querySelector('.play-btn').addEventListener('click', () => {
    hideAllPanels();
    document.getElementById('main-menu').style.display = 'none';
    startGame1();
  });
  
 document.querySelector('.scores-btn').addEventListener('click', () => {
    hideAllPanels();
    document.getElementById('main-menu').style.display = 'none';
    populateScoreDropdowns();
    showTopScores();
    document.getElementById('high-scores').style.display = 'block';
  });
  
  document.querySelector('.rules-btn').addEventListener('click', () => {
    hideAllPanels();
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('instructions').style.display = 'flex';
  });
  
  document.getElementById('close-rules').addEventListener('click', () => {
    document.getElementById('instructions').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
  });
  
  document.querySelector('.bottom-close').addEventListener('click', () => {
    document.getElementById('instructions').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
  });  

  document.querySelector('.settings-btn').addEventListener('click', () => {
    hideAllPanels();
    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('settings-panel').style.display = 'flex';
  });
  
  document.getElementById('close-settings-bottom').addEventListener('click', () => {
    document.getElementById('settings-panel').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
  });
  
 document.getElementById('submit-path').addEventListener('click', submitCurrentPath);
  
window.addEventListener('resize', () => {
    resizeCanvas();
    drawBoard();
    positionQuitButton();
});

/*
 * Display top scores
 * This function retrieves the top scores from localStorage and displays them in a table.
 */

// Hide the Top Scores panel when "Close" is clicked
document.getElementById('close-scores').addEventListener('click', () => {
    document.getElementById('high-scores').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex'; 
});
// Hide the Top Scores panel when "X" is clicked
document.getElementById('close-scores-x').addEventListener('click', () => {
    document.getElementById('high-scores').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex'; 
});


// Update scores when user changes grid size or moves selection
document.getElementById('score-grid-select').addEventListener('change', () => {
    lastSelectedGrid = document.getElementById('score-grid-select').value;
    updateMovesDropdown();   // Update the moves dropdown based on selected grid
    showTopScores();         // Then update the scores
});
document.getElementById('score-moves-select').addEventListener('change', () => {
    lastSelectedMoves = document.getElementById('score-moves-select').value;
    showTopScores();
});

function hideAllPanels() {
    document.getElementById('settings-panel').style.display = 'none';
    document.getElementById('instructions').style.display = 'none';
    document.getElementById('high-scores').style.display = 'none';
    document.getElementById('confirm-delete').style.display = 'none';
 }
  
// This fills the grid size and move limit dropdowns with available combinations
function populateScoreDropdowns() {
    const gridSelect = document.getElementById('score-grid-select');
    const movesSelect = document.getElementById('score-moves-select');

    const keys = Object.keys(localStorage);
    const gridSizes = new Set();
    const moveSets = {};

    keys.forEach(key => {
        if (key.startsWith('scores_total_')) {
            const match = key.match(/^scores_total_(\d+)x(\d+)$/);
            if (match) {
                const [_, grid, moves] = match;
                gridSizes.add(grid);
                if (!moveSets[grid]) moveSets[grid] = new Set();
                moveSets[grid].add(moves);
            }
        } else if (key.startsWith('scores_mean_')) {
            const grid = key.split('_')[2];
            gridSizes.add(grid);
        }
    });

    // Populate the grid size dropdown
    gridSelect.innerHTML = '';
    Array.from(gridSizes).sort((a, b) => a - b).forEach(grid => {
        const opt = document.createElement('option');
        opt.value = grid;
        opt.textContent = grid;
        if (grid === lastSelectedGrid) opt.selected = true;
        gridSelect.appendChild(opt);
    });

    updateMovesDropdown(moveSets);

    // Re-select the last moves value if still valid
    if (lastSelectedMoves) {
        const optionExists = Array.from(movesSelect.options).some(opt => opt.value === lastSelectedMoves);
        if (optionExists) {
            movesSelect.value = lastSelectedMoves;
        }
    }
}


// This updates the moves dropdown after a grid size is chosen
function updateMovesDropdown(preloadedMoveSets = null) {
    const grid = document.getElementById('score-grid-select').value;
    const movesSelect = document.getElementById('score-moves-select');

    let moveSet;
    if (preloadedMoveSets) {
        moveSet = preloadedMoveSets[grid] || new Set();
    } else {
        // If not preloaded, re-scan localStorage
        moveSet = new Set();
        Object.keys(localStorage).forEach(key => {
            const match = key.match(/^scores_total_([0-9]+)x([0-9]+)$/);
            if (match && match[1] === grid) {
                moveSet.add(match[2]);
            }
        });
    }

    movesSelect.innerHTML = '<option value="any">Any</option>';
    Array.from(moveSet).sort((a, b) => a - b).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m;
        opt.textContent = m;
        movesSelect.appendChild(opt);
    });
}

// This function displays the top scores based on the current dropdown selection
function showTopScores() {
    const grid = document.getElementById('score-grid-select').value;
    const moves = document.getElementById('score-moves-select').value;
    let scores = [];

    if (moves === 'any') {
        scores = JSON.parse(localStorage.getItem(`scores_mean_${grid}`)) || [];
        scores.sort((a, b) => b.mean - a.mean);
    } else {
        scores = JSON.parse(localStorage.getItem(`scores_total_${grid}x${moves}`)) || [];
        scores.sort((a, b) => b.score - a.score);
    }

    const table = document.getElementById('score-table');
    const showMoves = moves === 'any';

    // Build table header
    const headers = ['Total', 'Mean', ...(showMoves ? ['Moves'] : []), 'Date'];
    table.innerHTML = `
        <thead><tr>${headers.map(h => `<th style="border-bottom: 1px solid #ccc; padding: 6px;">${h}</th>`).join('')}</tr></thead>
        <tbody>
        ${scores.map(s => `
            <tr>
                <td style="text-align: center; padding: 6px;">${s.score}</td>
                <td style="text-align: center; padding: 6px;">${s.mean.toFixed(2)}</td>
                ${showMoves ? `<td style="text-align: center; padding: 6px;">${s.movesLimit}</td>` : ''}
                <td style="text-align: center; padding: 6px;">${s.date || ''}</td>
            </tr>`).join('')}
        </tbody>
    `;

    if (scores.length === 0) {
        table.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 10px;">No scores recorded yet.</td></tr>';
    }
}

function updateGameInfoVisibility() {
    const submitBtn = document.getElementById('submit-path');
    const infoWrapper = document.getElementById('info-wrapper');
    const gameInfoRow = document.getElementById('game-info-row');
    const quitButton = document.getElementById('quit-button');
  
    if (!gameOn) {
      // Game is not active: hide all buttons and info
      submitBtn.style.display = 'none';
      infoWrapper.style.display = 'none';
      gameInfoRow.style.display = 'none';
      quitButton.style.display = 'none';
      return;
    }
    else if (!manualSubmit) {
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
    if (path.length > 1) {
        submitBtn.style.display = 'inline-block';
        infoWrapper.style.display = 'none';
        gameInfoRow.style.display = 'flex';
      } else {
        submitBtn.style.display = 'none';
        infoWrapper.style.display = 'inline-block';
        gameInfoRow.style.display = 'flex';
      }
    }

  }
  
function positionQuitButton() {
    const canvas = document.getElementById('game-canvas');
    const h1 = document.querySelector('h1');
    const quitButton = document.getElementById('quit-button');

    if (!canvas || !h1 || !quitButton) return;

    const canvasRect = canvas.getBoundingClientRect();
    const h1Rect = h1.getBoundingClientRect();
    const parentRect = quitButton.offsetParent.getBoundingClientRect();

    // Align right edge of button with right edge of canvas
    const right = canvasRect.right - parentRect.left;
    // Align top with top of #score (relative to offsetParent)
    const top = h1Rect.top - parentRect.top;

    quitButton.style.position = 'absolute';
    quitButton.style.left = `${right - quitButton.offsetWidth}px`;
    quitButton.style.top = `${top}px`;
}

 // Create a board, in which all cells can be visited in one path
 function createSolvableBoard() {
    const result = generateFullyEliminatableBoard(gridSize, groups.length, facesPerGroup);
  
    if (!result) {
      console.warn("Falling back to random board");
      generateBoard(); // default random board
      dropCells(() => drawBoard());
      return;
    }
  
    board = result.hBoard;
    correctSolvablePath = result.hPath;
    dropCells(() => drawBoard());
}
  
// Only for debug: Show the correct solution for the board created by hamilton.js
window.visualizePath = function() {
    if (!Array.isArray(correctSolvablePath) || correctSolvablePath.length === 0) {
      console.warn("Invalid path passed to visualizePath.");
      return;
    }
    path = correctSolvablePath;
    recomputeDeltaScoresForPath();
    drawBoard();
    console.log("✔ Path visualized:", path);
  };
  
  
// Handle delete scores button
document.getElementById('delete-scores').addEventListener('click', () => {
    document.getElementById('confirm-delete').style.display = 'flex';
});

// Handle confirmation "Yes, delete"
document.getElementById('confirm-delete-yes').addEventListener('click', () => {
    // Delete all localStorage keys that start with 'scores_'
    Object.keys(localStorage).forEach(k => {
        if (k.startsWith('scores_')) localStorage.removeItem(k);
    });

    // Hide the confirmation and scores panel
    document.getElementById('confirm-delete').style.display = 'none';
    document.getElementById('high-scores').style.display = 'none';

    alert("Top scores have been cleared.");
});

// Handle cancellation
document.getElementById('confirm-delete-cancel').addEventListener('click', () => {
    document.getElementById('confirm-delete').style.display = 'none';
});

// Show confirm quit panel
document.getElementById('quit-button').addEventListener('click', () => {
    document.getElementById('quit-confirm').style.display = 'flex';
  });
  
  // Cancel quit
  document.getElementById('quit-no').addEventListener('click', () => {
    document.getElementById('quit-confirm').style.display = 'none';
  });
  
  // Confirm quit
  document.getElementById('quit-yes').addEventListener('click', () => {
    document.getElementById('quit-confirm').style.display = 'none';
    quit = true; // Set quit flag to true
    endGame();
  });

  loadSavedSettings();
