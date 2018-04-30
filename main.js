const maxStep = 1.0 / 60.0;

let canvas = null;
let context = null;
let slider = null;
let bestScore = null;
let currentGeneration = null;

let shouldJump = false;
let canJump = true;
window.onkeyup = function (e) { canJump = true; }
window.onkeydown = function (e) { if (canJump) shouldJump = true; canJump = false; }

let birds = [];
let pipes = [];

function load() {
    canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 800;

    context = canvas.getContext("2d");
    document.body.insertBefore(canvas, null);

    slider = document.getElementById("slider");
    bestScore = document.getElementById("bestScore");
    currentGeneration = document.getElementById("currentGeneration");

    newGeneration();

    loop();
}

function loop() {
    let timeNow = performance.now();
    window.requestAnimationFrame((timeThen) => {
        tick((timeThen - timeNow) / 1000.0);
        loop();
    });
}

function tick(delta) {
    let remaining = delta * slider.value;

    while (remaining > 0) {
        const step = Math.max(Math.min(remaining, maxStep), 0);
        remaining -= step;
        update(step);
    }

    draw();
}

class HumanBrain {
    jump(bird) {
        if (shouldJump) {
            shouldJump = false;
            return true;
        }
        return false;
    }
}

function activationFunction(value) {
    return Math.tanh(value);
}

const inputLayerSize = 5;
const hiddenLayerSize = 3;
const outputLayerSize = 1;
class KIBrain {
    constructor(oldBrain) {
        this.inputLayer = [];
        this.hiddenLayer = [];
        this.outputLayer = [];
        this.weights = [];

        if (!oldBrain) {
            let weightCounter = 0;
            for (let i = 0; i < hiddenLayerSize; i++) {
                for (let j = 0; j < inputLayerSize; j++) {
                    this.weights[weightCounter++] = Math.random() * 2 - 1;
                }
                this.weights[weightCounter++] = Math.random() * 2 - 1;
            }

            for (let i = 0; i < outputLayerSize; i++) {
                for (let j = 0; j < hiddenLayerSize; j++) {
                    this.weights[weightCounter++] = Math.random() * 2 - 1;
                }
                this.weights[weightCounter++] = Math.random() * 2 - 1;
            }
        } else {
            for (let i = 0; i < oldBrain.weights.length; i++) {
                this.weights[i] = oldBrain.weights[i];
                if(Math.random() < MutationChance)
                    this.weights[i] += (Math.random() * 2.0 - 1.0) * MutationFactor;
            }
        }
    }

    jump(bird) {
        const nextPipe = pipes.filter(p => p.x < p.x + PipeWidth).sort((p1, p2) => p1.x - p2.x)[0];

        if (!nextPipe) return false;

        this.inputLayer[0] = (bird.y + BirdSize / 2) / canvas.height;
        this.inputLayer[1] = bird.velY / BirdMaxVelocity;
        this.inputLayer[2] = nextPipe.gapPosition / canvas.height;
        this.inputLayer[3] = (nextPipe.gapPosition + PipeGapHeight) / canvas.height;
        this.inputLayer[4] = (nextPipe.x - bird.x) / canvas.width;


        let weightCounter = 0;
        for (let i = 0; i < hiddenLayerSize; i++) {
            let neuronSum = 0;
            for (let j = 0; j < inputLayerSize; j++) {
                neuronSum += this.inputLayer[j] * this.weights[weightCounter++];
            }
            neuronSum += this.weights[weightCounter++];
            this.hiddenLayer[i] = activationFunction(neuronSum);
        }

        for (let i = 0; i < outputLayerSize; i++) {
            let neuronSum = 0;
            for (let j = 0; j < hiddenLayerSize; j++) {
                neuronSum += this.hiddenLayer[j] * this.weights[weightCounter++];
            }
            neuronSum += this.weights[weightCounter++];
            this.outputLayer[i] = activationFunction(neuronSum);
        }

        return this.outputLayer[0] > 0;
    }
}

function intersectRect(r1, r2) {
    return !(r2.left > r1.right ||
        r2.right < r1.left ||
        r2.top > r1.bottom ||
        r2.bottom < r1.top);
}

let oldGeneration = [];
const BirdSize = 60;
const BirdGravity = 1100;
const BirdFlapVelocity = 480;
const BirdMaxVelocity = 700;
const BirdImage = new Image(BirdSize, BirdSize);
BirdImage.src = "assets/bird.png";
class Bird {
    constructor(brain) {
        this.width = BirdSize;
        this.height = BirdSize;
        this.x = this.width;
        this.y = canvas.height / 2 - this.height / 2;
        this.velY = 0;
        this.brain = brain;
        this.alive = true;
        this.score = 0;
    }

    update(delta) {
        this.velY += BirdGravity * delta;
        this.velY = Math.max(Math.min(BirdMaxVelocity, this.velY), -BirdMaxVelocity);
        this.y += this.velY * delta + 0.5 * BirdGravity * delta * delta;

        if (this.y + BirdSize > canvas.height || this.y < 0)
            this.die();

        const myRect = this.getRect();
        for (let i = 0; i < pipes.length; i++) {
            if (pipes[i].getRects().find(r => intersectRect(myRect, r))) {
                this.die();
                break;
            }
        }

        if (this.alive) {
            this.score += delta;
            if (this.brain.jump(this)) {
                this.velY = -BirdFlapVelocity;
            }
        }
    }

    draw() {
        context.drawImage(BirdImage, this.x, this.y, BirdSize, BirdSize);
    }

    die() {
        if (!this.alive) return;
        this.alive = false;

        oldGeneration.push(this);
    }

    getRect() {
        return { left: this.x, right: this.x + this.width, top: this.y, bottom: this.y + this.height };
    }
}

const PipeWidth = 80;
const PipeGapHeight = 160;
const PipeSpeed = 280;
const PipeMinDistance = 80;
class Pipe {
    constructor() {
        this.width = PipeWidth;

        this.gapPosition = Math.random() * (canvas.height - PipeMinDistance * 2 - PipeGapHeight) + PipeMinDistance;
        this.x = canvas.width;
    }

    update(delta) {
        this.x -= PipeSpeed * delta;
    }

    draw() {
        context.fillRect(this.x, 0, this.width, this.gapPosition);
        context.fillRect(this.x, this.gapPosition + PipeGapHeight, this.width, canvas.height - this.gapPosition - PipeGapHeight);
    }

    getRects() {
        return [
            { left: this.x, right: this.x + this.width, top: 0, bottom: this.gapPosition },
            { left: this.x, right: this.x + this.width, top: this.gapPosition + PipeGapHeight, bottom: canvas.height }
        ];
    }
}

const PopulationSize = 100;
const PopulationTop = 20;
const MutationFactor = 0.5;
const MutationChance = 0.8;
let currentGenerationCounter = 0;
let bestScoreBrains = [];
function newGeneration() {
    pipes = [];
    pipeSpawnTimer = PipeSpawnInterval;

    if (oldGeneration.length == 0) {
        for (let i = 0; i < PopulationSize; i++) {
            birds.push(new Bird(new KIBrain()));
        }
    } else {
        oldGeneration.sort((b1, b2) => b2.score - b1.score);

        if(oldGeneration[0].score > bestScore.innerHTML) {
            bestScore.innerHTML = oldGeneration[0].score;
            bestScoreBrains.push(oldGeneration[0]);
        }
        currentGeneration.innerHTML = currentGenerationCounter++;

        for (let i = 0; i < PopulationTop; i++) {
            for (let j = 0; j < PopulationSize / PopulationTop; j++) {
                birds.push(new Bird(new KIBrain(oldGeneration[i].brain)));
            }
        }
    }

    oldGeneration = [];
}

const PipeSpawnInterval = 1.8;
let pipeSpawnTimer = PipeSpawnInterval;
function update(delta) {
    birds.forEach(b => b.update(delta));
    pipes.forEach(p => p.update(delta));

    pipes = pipes.filter(p => p.x + PipeWidth > 0);
    birds = birds.filter(b => b.y < canvas.height);

    pipeSpawnTimer += delta;
    if (pipeSpawnTimer > PipeSpawnInterval) {
        pipeSpawnTimer -= PipeSpawnInterval;
        pipes.push(new Pipe());
    }

    if (birds.length <= 0) {
        newGeneration();
    }
}

function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);

    birds.forEach(b => b.draw());
    pipes.forEach(p => p.draw());
}