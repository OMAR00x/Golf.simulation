import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class GraphicsSystem {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();
        this.ballMesh = null;
        this.trajectoryPoints = [];

        this.initCore();
        this.initGolfCourse();
        this.generateEnvironmentDecorations(); // إضافة موديلات وبيئة محيطة غنية
        this.initTrajectoryLine();
        this.loadBallModel();
        
        window.addEventListener('resize', () => this.onWindowResize());
    }

    initCore() {
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 4000);
        this.camera.position.set(-25, 12, 35);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
    }

    initGolfCourse() {
        this.scene.background = new THREE.Color(0x7ec0ee);
        this.scene.fog = new THREE.FogExp2(0x7ec0ee, 0.0012);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
        this.scene.add(ambientLight);

        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.95);
        this.dirLight.position.set(300, 500, 200);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.mapSize.width = 4096;
        this.dirLight.shadow.mapSize.height = 4096;
        this.dirLight.shadow.camera.left = -400;
        this.dirLight.shadow.camera.right = 400;
        this.dirLight.shadow.camera.top = 400;
        this.dirLight.shadow.camera.bottom = -400;
        this.scene.add(this.dirLight);

        // العشب الطويل المحيط (Rough)
        const roughGeo = new THREE.PlaneGeometry(3000, 1200);
        const roughMat = new THREE.MeshStandardMaterial({ color: 0x1b4332, roughness: 0.95 });
        const rough = new THREE.Mesh(roughGeo, roughMat);
        rough.rotation.x = -Math.PI / 2;
        rough.position.set(400, -0.02, 0);
        rough.receiveShadow = true;
        this.scene.add(rough);

        // الممر الرئيسي القصير (Fairway)
        const fairwayGeo = new THREE.BoxGeometry(600, 0.02, 50);
        const fairwayMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.7 });
        const fairway = new THREE.Mesh(fairwayGeo, fairwayMat);
        fairway.position.set(300, 0, 0);
        fairway.receiveShadow = true;
        this.scene.add(fairway);

        // منطقة الحفرة الخضراء (The Green)
        const greenGeo = new THREE.CylinderGeometry(25, 25, 0.04, 32);
        const greenMat = new THREE.MeshStandardMaterial({ color: 0x40916c, roughness: 0.5 });
        const green = new THREE.Mesh(greenGeo, greenMat);
        green.position.set(350, 0, 0);
        green.receiveShadow = true;
        this.scene.add(green);

        // الحفرة (The Hole)
        const holeGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.06, 16);
        const holeMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
        const hole = new THREE.Mesh(holeGeo, holeMat);
        hole.position.set(350, 0.011, 0);
        this.scene.add(hole);

        // الراية والعمود
        this.createFlag(350, 0, 0);
    }

    // توليد عناصر البيئة المحيطة (أشجار، حفر رملية تزيد من واقعية المشهد)
    generateEnvironmentDecorations() {
        // 1. إضافة مصائد رملية (Sand Bunkers) بجانب الممر المخصص
        const bunkerGeo = new THREE.CylinderGeometry(12, 16, 0.03, 16);
        const bunkerMat = new THREE.MeshStandardMaterial({ color: 0xe9c46a, roughness: 0.9 }); // لون الرمل الذهبي
        
        const bunker1 = new THREE.Mesh(bunkerGeo, bunkerMat);
        bunker1.position.set(180, 0.005, -35);
        bunker1.receiveShadow = true;
        this.scene.add(bunker1);

        const bunker2 = new THREE.Mesh(bunkerGeo, bunkerMat);
        bunker2.position.set(280, 0.005, 35);
        bunker2.receiveShadow = true;
        this.scene.add(bunker2);

        // 2. توزيع أشجار مجسمة ثلاثية الأبعاد (Procedural Trees) على أطراف الممر
        for (let i = 0; i < 60; i++) {
            const tree = this.createTreeModel();
            // توزيع عشوائي آمن بعيداً عن الممر الوسطي للكرة
            const sign = Math.random() > 0.5 ? 1 : -1;
            const x = Math.random() * 600 + 20;
            const z = sign * (Math.random() * 100 + 45); 
            tree.position.set(x, 0, z);
            this.scene.add(tree);
        }
    }

    // بناء مجسم شجرة هندسي واقعي وخفيف الأداء
    createTreeModel() {
        const treeGroup = new THREE.Group();

        // الجذع الخشبي
        const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 4, 8);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 2;
        trunk.castShadow = true;
        treeGroup.add(trunk);

        // الأوراق الخضراء (أقسام هرمية متداخلة لإعطاء مظهر غني)
        const leavesMat = new THREE.MeshStandardMaterial({ color: 0x132a13, roughness: 0.8 });
        
        for (let i = 0; i < 3; i++) {
            const leavesGeo = new THREE.ConeGeometry(3 - i * 0.6, 4, 8);
            const leaves = new THREE.Mesh(leavesGeo, leavesMat);
            leaves.position.y = 4.5 + i * 2;
            leaves.castShadow = true;
            treeGroup.add(leaves);
        }

        // حجم عشوائي طفيف للأشجار لمحاكاة الطبيعة
        const scale = 0.8 + Math.random() * 0.5;
        treeGroup.scale.set(scale, scale, scale);

        return treeGroup;
    }

    createFlag(x, y, z) {
        const flagGroup = new THREE.Group();
        flagGroup.position.set(x, y, z);
        const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 4.5, 8);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 2.25;
        pole.castShadow = true;
        flagGroup.add(pole);

        const clothGeo = new THREE.BoxGeometry(0.9, 0.6, 0.02);
        const clothMat = new THREE.MeshStandardMaterial({ color: 0xef233c });
        const cloth = new THREE.Mesh(clothGeo, clothMat);
        cloth.position.set(0.45, 4.1, 0);
        cloth.castShadow = true;
        flagGroup.add(cloth);
        this.scene.add(flagGroup);
    }

    initTrajectoryLine() {
        this.trackMaterial = new THREE.LineBasicMaterial({ color: 0xffdd00, linewidth: 3 });
        this.trackGeometry = new THREE.BufferGeometry();
        this.trajectoryLine = new THREE.Line(this.trackGeometry, this.trackMaterial);
        this.scene.add(this.trajectoryLine);
    }

    appendTrajectoryPoint(x, y, z) {
        this.trajectoryPoints.push(new THREE.Vector3(x, y, z));
        this.trackGeometry.setFromPoints(this.trajectoryPoints);
    }

    clearTrajectory() {
        this.trajectoryPoints = [];
        this.trackGeometry.setFromPoints([]);
    }

    loadBallModel() {
        const loader = new GLTFLoader();
        const fallbackGeo = new THREE.SphereGeometry(0.2, 32, 32);
        const fallbackMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
        
        this.ballGroup = new THREE.Group();
        this.scene.add(this.ballGroup);

        loader.load(
            './assets/golf_ball.glb',
            (gltf) => {
                this.ballMesh = gltf.scene;
                this.ballMesh.scale.setScalar(5); // الحجم البصري الأمثل للمشاهدة والتتبع المريح
                this.ballMesh.traverse((node) => {
                    if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
                });
                this.ballGroup.add(this.ballMesh);
            },
            undefined,
            () => {
                const mesh = new THREE.Mesh(fallbackGeo, fallbackMat);
                mesh.castShadow = true;
                this.ballGroup.add(mesh);
                this.ballMesh = mesh;
            }
        );
    }

    updateCameraFollow(ballPos) {
        this.camera.position.x = ballPos.x - 22;
        this.camera.position.y = ballPos.y + 7;
        this.camera.position.z = ballPos.z + 12; // زاوية تتبع سينمائية ممتازة خلف الكرة
        this.controls.target.copy(ballPos);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}