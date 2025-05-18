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

const groups = ['french', 'asian', 'ethio', 'eng', 'scand']; // Number of groups
const facesPerGroup = 4;
const faceImages = [];
let currentEliminatedGroups = [];

// Preload face images
function preloadFaceImages(callback) {
    let loaded = 0;
    for (let g = 0; g < groups.length; g++) {
        faceImages[g] = [];
        for (let i = 1; i <= facesPerGroup; i++) {
            const img = new Image();
            img.src = `images/women/${groups[g]}${i}.jpg`;
            img.onload = () => {
                loaded++;
                if (loaded === groups.length * facesPerGroup) callback();
            };
            faceImages[g][i-1] = img;
        }
    }
}

function startGame() {
    gridSize = parseInt(document.getElementById('grid-size').value);
    movesLeft = parseInt(document.getElementById('moves-limit').value);

    document.getElementById('controls').style.display = 'none';
    document.getElementById('game-info').style.display = 'block';
    document.getElementById('game-container').style.display = 'block';
    document.getElementById('game-over').style.display = 'none';
    
    const container = document.getElementById('game-container');
    canvas.style.display = 'block'; // restore canvas if hidden

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
    canvas.width = canvas.height = Math.min(window.innerWidth, window.innerHeight) * 0.8;
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

    ctx.save();
    ctx.globalAlpha = 0.12; // Adjust to taste
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
    
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;

    const x = Math.floor(offsetX / cellSize);
    const y = Math.floor(offsetY / cellSize);

    // Calculate the fractional position within the cell
    const fracX = (offsetX % cellSize) / cellSize;
    const fracY = (offsetY % cellSize) / cellSize;

    // Only return the cell if the pointer is at least 20% into it (both directions)
    if (fracX > 0.2 && fracX < 0.8 && fracY > 0.2 && fracY < 0.8) {
        return { x, y };
    } else {
        return { x: -1, y: -1 };
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

    const { x, y } = getCellFromEvent(evt);
    if (isInGrid(x, y)) {
        path.push({ x, y });
        currentGroup = board[y][x].group;
        visitedGroups.add(currentGroup);
    }
    drawBoard();
}


// Recompute delta scores for all the cells in the path
function recomputeDeltaScoresForPath() {
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
    const { x, y } = getCellFromEvent(evt);
    if (!isInGrid(x, y)) return;

    // Handle backtracking
    const backtracking = path.length >= 2 &&
    path[path.length - 2].x === x &&
    path[path.length - 2].y === y;

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

        // Disallow changing straight direction without diagonal in between
        if (lastDirection && lastDirection!=='diagonal' && lastDirection !== direction) return;

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
    updateInfo();

    movesLeft--;
    if (movesLeft <= 0) endGame();

    path = [];
    visitedGroups = new Set();
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
    // If some groups were eliminated but not all, exclude the eliminated groups from selection
    let allowedGroups = (currentEliminatedGroups.length > 0 && currentEliminatedGroups.length != groups.length)
        ? [...Array(groups.length).keys()].filter(g => !currentEliminatedGroups.includes(g))
        : [...Array(groups.length).keys()];

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
    document.getElementById('score').textContent = `Score: ${score}`;
    const mean = moves > 0 ? (score / moves).toFixed(2) : '0';
    document.getElementById('mean-score').textContent = `Mean Score: ${mean}`;
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

    document.getElementById('game-container').style.display = 'none';

    document.getElementById('controls').style.display = 'block';

    document.getElementById('game-over').style.display = 'block';
    document.getElementById('final-score').textContent = score;
    const mean = moves > 0 ? (score / moves).toFixed(2) : '0';
    document.getElementById('final-mean-score').textContent = mean;

}

document.getElementById('start-game').addEventListener('click', () => {
    // Check if images are already loaded
    let alreadyLoaded = faceImages.length === groups.length &&
        faceImages.every(group => group.length === facesPerGroup && group.every(img => img.complete));

    if (alreadyLoaded) {
        startGame();
    } else {
        preloadFaceImages(startGame);
    }
});
