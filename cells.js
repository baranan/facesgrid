
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

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
    score = 0; 

    let newFaceSet = document.getElementById('face-set').value;
    gridSize = parseInt(document.getElementById('grid-size').value);
    movesLeft = parseInt(document.getElementById('moves-limit').value);
    movesLeftOriginal = movesLeft; // Store original moves limit for later use
    scoreDisplayMode = document.getElementById('score-overlay-toggle').value;

    document.getElementById('controls').style.display = 'none';
    document.getElementById('instructions').style.display = 'none';
    document.getElementById('game-info').style.display = 'block';
    document.getElementById('game-container').style.display = 'block';
    document.getElementById('game-over').style.display = 'none';

    console.log('closing high-scores panel if open');
    document.getElementById('high-scores').style.display = 'none';

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
        ctx.font = `${canvas.width * 0.98}px Arial`;
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
    evt.preventDefault();
    isMouseDown = true;
    path = [];
    visitedGroups = new Set();
    loopClosed = false;
    lastDirection = null;

    const cell = getCellFromEvent(evt);
    if (!cell) return;    
    const { x, y } = cell;

    if (isInGrid(x, y)) {
        path.push({ x, y });
        currentGroup = board[y][x].group;
        visitedGroups.add(currentGroup);
    }
    drawBoard();
}

function recomputeDeltaScoresForPath() {
    if (path.length === 0) return;

    // First cell doesn't represent a move
    path[0].deltaScore = 0;

    // -------- Loop Bonus Calculation --------
    let loopBonus = 0;
    if (loopClosed) {
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const cell = board[y][x];
                const alreadyVisited = path.some(p => p.x === x && p.y === y);
                if (cell && !alreadyVisited && visitedGroups.has(cell.group)) {
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

// Obsolete: Recompute delta scores for all the cells in the path
function recomputeDeltaScoresForPathGeometic() {
    // Track how many straight moves have been made in a row
    let consecutiveStraightMoves = 0;

    // Ensure the first cell has a delta score of 0 (no move yet)
    if (path.length > 0) path[0].deltaScore = 0;

    // Compute loop bonus once, if the loop is closed
    let loopBonus = 0;
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

    // Walk through the path starting from the second cell
    for (let i = 1; i < path.length; i++) {
        const prev = path[i - 1];
        const curr = path[i];

        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        const isStraight = (dx === 0 || dy === 0) && (absDx + absDy === 1);
        const isDiagonal = absDx === 1 && absDy === 1;

        // Assign direction
        curr.direction = isStraight
            ? (dx === 0 ? 'vertical' : 'horizontal')
            : (isDiagonal ? 'diagonal' : null);

        // Update straight-move streak
        if (isStraight) {
            consecutiveStraightMoves++;
        } else {
            consecutiveStraightMoves = 0;
        }

        // Compute base score for the move
        let deltaScore = 0;
        if (isStraight) {
            deltaScore += Math.pow(2, consecutiveStraightMoves);
        }
        if (isDiagonal) {
            deltaScore -= 1;
        }

        // Only the **last** cell in the path should get the loop bonus
        if (loopClosed && i === path.length - 1) {
            deltaScore += loopBonus;
        }

        // Assign final score
        curr.deltaScore = deltaScore;
    }
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
        const start = path[0];
        loopClosed = path.slice(1).some(p => p.x === start.x && p.y === start.y);

        drawBoard();
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

    if (isFirst && path.length >= 3) {
        loopClosed = true;
    }

    path.push({ x, y, direction });
    recomputeDeltaScoresForPath(); // 🔁 Recompute all deltaScores
    drawBoard();
    return;
}

function handleEnd(evt) {
    evt.preventDefault();
    isMouseDown = false;

    if (path.length < 2) {
        path = [];
        document.querySelector('h1').textContent = `Total Score: ${score}`;
        return;
    }

    let affected = [...path];

    // Eliminate all faces from all visited groups
    currentEliminatedGroups = [...visitedGroups];
    if (loopClosed) {  
        // Replace 'affected' with all faces from those groups
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
  
    animateRemoval(affected);
    moves++;
    total += affected.length;

    movesLeft--;
    if (movesLeft <= 0) setTimeout(endGame, 1000);

    updateInfo();

    path = [];
    visitedGroups = new Set();

    const header = document.querySelector('h1');
    if (header) {
        header.textContent = `Total Score: ${score}`;
    }
}

function animateRemoval(cells) {
    for (const { x, y } of cells) {
        const cell = board[y][x];
        if (!cell) continue;
        cell.exploding = true;
        cell.scale = 1.0;
    }

    const totalFrames = 30;
    let frame = 0;

    function step() {
        for (const { x, y } of cells) {
            const cell = board[y][x];
            if (!cell || !cell.exploding) continue;
            cell.scale = 1 - frame / totalFrames;
            if (cell.scale < 0) cell.scale = 0;
        }

        drawBoard();
        frame++;
        if (frame <= totalFrames) {
            requestAnimationFrame(step);
        } else {
            for (const { x, y } of cells) {
                board[y][x] = null;
            }
            dropCells(() => drawBoard());
        }
    }

    step();
}

// Drop cells down to fill empty spaces
function dropCells(callback) {
    fallingCells = [];

    // Determine which groups are allowed for newly generated faces
    // 
    let allowedGroups;
    if (currentEliminatedGroups.length < groups.length - 1) {
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

function endGame() {

    canvas.removeEventListener('mousedown', handleStart);
    canvas.removeEventListener('mousemove', handleMove);
    canvas.removeEventListener('mouseup', handleEnd);
    canvas.removeEventListener('touchstart', handleStart);
    canvas.removeEventListener('touchmove', handleMove);
    canvas.removeEventListener('touchend', handleEnd);

    document.getElementById('game-info').style.display = 'none';
    canvas.style.display = 'none';

    document.querySelector('h1').textContent = '';

    document.getElementById('game-container').style.display = 'none';

    //document.getElementById('controls').style.display = 'block';
    document.getElementById('controls').style.removeProperty('display');


    document.getElementById('game-over').style.display = 'block';
    document.getElementById('final-score').textContent = score;
    const mean = moves > 0 ? (score / moves).toFixed(2) : '0';
    document.getElementById('final-mean-score').textContent = mean;

    saveHighScores(score, gridSize, movesLeftOriginal, parseFloat(mean));
    document.getElementById('show-scores').style.display = 'inline-block';
}

document.getElementById('start-game').addEventListener('click', () => {
    startGame1();    
});

document.getElementById('toggle-rules').addEventListener('click', () => {
    document.getElementById('instructions').style.display = 'flex';
  });
  
  document.getElementById('close-rules').addEventListener('click', () => {
    document.getElementById('instructions').style.display = 'none';
  });
  
  document.querySelector('.bottom-close').addEventListener('click', () => {
    document.getElementById('instructions').style.display = 'none';
  });
  
window.addEventListener('resize', () => {
    resizeCanvas();
    drawBoard();
});

/*
 * Display top scores
 * This function retrieves the top scores from localStorage and displays them in a table.
 */
// Show the "Top Scores" panel when the user clicks the button
document.getElementById('show-scores').addEventListener('click', () => {
    populateScoreDropdowns();     // Fill dropdowns with available grid sizes and moves
    showTopScores();              // Display the scores for the default selection
    document.getElementById('high-scores').style.display = 'block';  // Show the panel
});

// Hide the Top Scores panel when "Close" is clicked
document.getElementById('close-scores').addEventListener('click', () => {
    document.getElementById('high-scores').style.display = 'none';
});
// Hide the Top Scores panel when "X" is clicked
document.getElementById('close-scores-x').addEventListener('click', () => {
    document.getElementById('high-scores').style.display = 'none';
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
