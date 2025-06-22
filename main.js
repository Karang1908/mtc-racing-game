// Basic Three.js scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(0, 1, 0.5);
scene.add(light);

// Road
const roadWidth = 30;
const segmentLength = 20;
const numSegments = 20;
const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, side: THREE.DoubleSide });
const roadSegments = [];

const textureLoader = new THREE.TextureLoader();
const grassTexture = textureLoader.load('Grass004_1K-JPG/Grass004_1K-JPG_Color.jpg');
grassTexture.wrapS = THREE.RepeatWrapping;
grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(10, 10);
const groundMaterial = new THREE.MeshStandardMaterial({ map: grassTexture });
const groundSegments = [];
const trees = [];
const obstacles = [];
const numObstacles = 35;
let spawnDistance = 0;
let distanceToNextSpawn = 40;

let treeModel = null;
let lives = 3;
let gameOver = false;
let distance = 0;

const livesContainer = document.getElementById('lives-container');
const distanceContainer = document.getElementById('distance-container');
const livesCountElement = document.getElementById('lives-count');
const distanceCountElement = document.getElementById('distance-count');

const objLoader = new THREE.OBJLoader();
objLoader.load('low_poly_tree/Lowpoly_tree_sample.obj', (obj) => {
    treeModel = obj;
    treeModel.scale.set(0.32, 0.32, 0.32); // Adjust scale as needed
    
    // Apply a green material
    const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x006400 });
    treeModel.traverse((child) => {
        if (child.isMesh) {
            child.material = treeMaterial;
        }
    });

    // Initial tree placement
    for(let i = 0; i < numSegments * 10; i++) {
        const tree = treeModel.clone();
        const segmentIndex = Math.floor(i / 10);
        const roadSegment = roadSegments[segmentIndex];

        const side = Math.random() > 0.5 ? 1 : -1;
        const xPos = (roadWidth / 2 + Math.random() * 10) * side;
        const zPos = Math.random() * -segmentLength;

        tree.position.set(xPos, 0, roadSegment.position.z + zPos);
        scene.add(tree);
        trees.push(tree);
    }
});

for(let i = 0; i < numSegments; i++) {
    const segmentGroup = new THREE.Group();

    const roadGeometry = new THREE.PlaneGeometry(roadWidth, segmentLength, 1, 20);
    const road = new THREE.Mesh(roadGeometry, roadMaterial);
    road.rotation.x = -Math.PI / 2;
    segmentGroup.add(road);

    // Add dashed lines
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const dashLength = 4;
    const gapLength = 2;
    const lineThickness = 0.2;
    const numDashes = Math.floor(segmentLength / (dashLength + gapLength));
    
    for (let j = 0; j < numDashes; j++) {
        const dashGeometry = new THREE.PlaneGeometry(lineThickness, dashLength);
        
        // Line 1
        const dash1 = new THREE.Mesh(dashGeometry, lineMaterial);
        dash1.rotation.x = -Math.PI / 2;
        const zPos = -segmentLength / 2 + j * (dashLength + gapLength) + dashLength / 2;
        dash1.position.set(-roadWidth / 6, 0.01, zPos);
        segmentGroup.add(dash1);

        // Line 2
        const dash2 = new THREE.Mesh(dashGeometry.clone(), lineMaterial);
        dash2.rotation.x = -Math.PI / 2;
        dash2.position.set(roadWidth / 6, 0.01, zPos);
        segmentGroup.add(dash2);
    }

    segmentGroup.position.z = i * -segmentLength;
    scene.add(segmentGroup);
    roadSegments.push(segmentGroup);

    const groundGeometry = new THREE.PlaneGeometry(500, segmentLength, 1, 1);
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.position.z = i * -segmentLength;
    scene.add(ground);
    groundSegments.push(ground);
}

const obstacleTexture = textureLoader.load('alley-brick-wall-unity/alley-brick-wall_albedo.png');
obstacleTexture.wrapS = THREE.RepeatWrapping;
obstacleTexture.wrapT = THREE.RepeatWrapping;
obstacleTexture.repeat.set(0.5, 0.5);
const obstacleMaterial = new THREE.MeshStandardMaterial({ map: obstacleTexture });
const obstacleGeometry = new THREE.BoxGeometry(roadWidth / 3 - 2, 4, 2); // Width, Height, Depth

for (let i = 0; i < numObstacles; i++) {
    const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
    obstacle.visible = false;
    scene.add(obstacle);
    obstacles.push(obstacle);
}

camera.position.set(0, 10, 15);

// Car
const car = new THREE.Group();
car.position.set(0, 1, 0);
scene.add(car);

const loader = new THREE.GLTFLoader();
loader.load('Untitled.glb', (gltf) => {
    const model = gltf.scene;
    model.scale.set(1.25, 1.25, 1.25);
    model.rotation.y = Math.PI; // Corrective rotation
    
    const newMaterial = new THREE.MeshStandardMaterial({ color: 0x4d0f0f });
    model.traverse((child) => {
        if (child.isMesh) {
            child.material = newMaterial;
        }
    });

    car.add(model);
}, undefined, (error) => {
    console.error(error);
});

const keys = {
    w: false,
    a: false,
    s: false,
    d: false
};

document.addEventListener('keydown', (event) => {
    if(keys[event.key] !== undefined) {
        keys[event.key] = true;
    }
});
document.addEventListener('keyup', (event) => {
    if(keys[event.key] !== undefined) {
        keys[event.key] = false;
    }
});

let carSpeed = 0;
let carSteering = 0;
let animationFrameId;

function startGame() {
    document.getElementById('start-screen').style.display = 'none';
    document.body.style.backgroundImage = 'none';
    livesContainer.style.display = 'block';
    distanceContainer.style.display = 'block';
    
    animate();
}

document.getElementById('start-button').addEventListener('click', startGame);

function animate() {
    if (gameOver) {
        cancelAnimationFrame(animationFrameId);
        return;
    }
    animationFrameId = requestAnimationFrame(animate);

    // Don't start animation until model is loaded
    if (car.children.length === 0) return;

    // Update distance
    distance += carSpeed * 0.1; // Adjust multiplier for desired "speed" of distance accumulation
    distanceCountElement.innerText = Math.floor(distance) + 'm';

    // Handle Controls
    if (keys.w) {
        carSpeed = Math.min(carSpeed + 0.02, 2.0);
    } else if (keys.s) {
        carSpeed = Math.max(carSpeed - 0.02, -0.2);
    } else {
        // Decelerate
        if (carSpeed > 0) carSpeed = Math.max(carSpeed - 0.01, 0);
        if (carSpeed < 0) carSpeed = Math.min(carSpeed + 0.01, 0);
    }

    if(keys.d) { // Steer Right
        carSteering = Math.min(carSteering + 0.2, 0.7);
    } else if(keys.a) { // Steer Left
        carSteering = Math.max(carSteering - 0.2, -0.7);
    } else {
        // Straighten wheel
        if (carSteering > 0) carSteering = Math.max(carSteering - 0.02, 0);
        if (carSteering < 0) carSteering = Math.min(carSteering + 0.02, 0);
    }
    
    car.rotation.y = -carSteering;
    
    // Move the world toward the camera
    roadSegments.forEach(segment => {
        segment.position.z += carSpeed * 2;
    });
    groundSegments.forEach(segment => {
        segment.position.z += carSpeed * 2;
    });
    trees.forEach(tree => {
        tree.position.z += carSpeed * 2;
    });

    // Recycle road, ground, and tree segments
    const firstRoadSegment = roadSegments[0];
    if (firstRoadSegment.position.z > camera.position.z) {
        const lastRoadSegment = roadSegments[roadSegments.length - 1];
        const newZ = lastRoadSegment.position.z - segmentLength;
        
        // Move road segment
        firstRoadSegment.position.z = newZ;
        roadSegments.push(roadSegments.shift());

        // Move ground segment
        const firstGroundSegment = groundSegments[0];
        firstGroundSegment.position.z = newZ;
        groundSegments.push(groundSegments.shift());

        // Move a batch of trees
        if (treeModel) {
            for (let i = 0; i < 10; i++) {
                const tree = trees.shift();
                const side = Math.random() > 0.5 ? 1 : -1;
                const xPos = (roadWidth / 2 + Math.random() * 10) * side;
                const zPos = Math.random() * -segmentLength;
                tree.position.set(xPos, 0, newZ + zPos);
                trees.push(tree);
            }
        }
    }

    // --- Obstacle Logic ---
    // Move and recycle
    obstacles.forEach(obstacle => {
        if(obstacle.visible) {
            obstacle.position.z += carSpeed * 2;
            if(obstacle.position.z > camera.position.z) {
                obstacle.visible = false;
            }
        }
    });

    // Spawn new obstacles based on distance traveled
    spawnDistance += carSpeed * 2;
    if (spawnDistance > distanceToNextSpawn) {
        spawnDistance = 0;
        distanceToNextSpawn = Math.random() * 100 + 50; // Next one in 50-150 units

        const inactiveObstacle = obstacles.find(o => !o.visible);
        if (inactiveObstacle) {
            const lastRoadSegment = roadSegments[roadSegments.length-1];
            const lane = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
            inactiveObstacle.position.x = lane * (roadWidth / 3);
            inactiveObstacle.position.y = 3;
            inactiveObstacle.position.z = lastRoadSegment.position.z - segmentLength;
            inactiveObstacle.visible = true;
        }
    }
    
    // Collision Detection
    const carBoundingBox = new THREE.Box3().setFromObject(car);
    obstacles.forEach(obstacle => {
        if (obstacle.visible) {
            const obstacleBoundingBox = new THREE.Box3().setFromObject(obstacle);
            if(carBoundingBox.intersectsBox(obstacleBoundingBox)) {
                lives--;
                livesCountElement.innerText = lives;
                obstacle.visible = false;

                if (lives <= 0) {
                    gameOver = true;
                    alert("Game Over!");
                    // Optional: Add a restart button or refresh the page
                    location.reload();
                }
            }
        }
    });

    // Handle steering
    car.position.x += carSteering * carSpeed * 0.8;

    // Clamp car's position to the road width
    if (Math.abs(car.position.x) > roadWidth / 2) {
        car.position.x = (roadWidth / 2) * Math.sign(car.position.x);
    }

    // Keep camera on the car
    camera.position.x = car.position.x;
    camera.lookAt(car.position);

    renderer.render(scene, camera);
}

// Handle window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}, false);
