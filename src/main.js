import * as THREE from 'three';
import { GraphicsSystem } from './graphics.js';
import { solveRK4, handleCollisions } from './physics.js';

const graphics = new GraphicsSystem();

// متغيرات تتبع الحركة الفيزيائية
let pos = { x: 0, y: 0, z: 0 };
let vel = { x: 0, y: 0, z: 0 };
let omega = { x: 0, y: 0, z: 0 };
let isFlying = false;
let timeElapsed = 0;

const h = 0.016; // فروق الخطوة الزمنية dTime

// ربط عناصر واجهة العدادات الرقمية
const dashAlt = document.getElementById('dash-alt');
const dashVel = document.getElementById('dash-vel');
const dashDist = document.getElementById('dash-dist');
const dashStatus = document.getElementById('dash-status');

// --- إعداد وهندسة المخطط البياني (Chart.js) ---
let chartInstance = null;
let chartLabels = [];
let chartAltData = [];
let chartVelData = [];

function initChart() {
    const ctx = document.getElementById('physicsChart').getContext('2d');
    
    // تدمير أي مخطط قديم لتجنب التداخل والتكرار عند إعادة الإطلاق
    if (chartInstance) chartInstance.destroy();

    chartLabels = [0];
    chartAltData = [0];
    chartVelData = [0];

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartLabels,
            datasets: [
                {
                    label: 'الارتفاع (متر)',
                    data: chartAltData,
                    borderColor: '#ffaa00',
                    backgroundColor: 'transparent',
                    yAxisID: 'y-alt',
                    borderWidth: 2,
                    pointRadius: 0 // إلغاء النقاط لتسريع المعالجة والرسم
                },
                {
                    label: 'السرعة اللحظية (م/ث)',
                    data: chartVelData,
                    borderColor: '#00ffcc',
                    backgroundColor: 'transparent',
                    yAxisID: 'y-vel',
                    borderWidth: 2,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'الزمن (ثانية)', font: { size: 10 } } },
                'y-alt': { type: 'linear', position: 'right', title: { display: true, text: 'الارتفاع', color: '#ffaa00' } },
                'y-vel': { type: 'linear', position: 'left', title: { display: true, text: 'السرعة', color: '#00ffcc' } }
            },
            plugins: { legend: { labels: { boxWidth: 12, font: { size: 10 } } } }
        }
    });
}

// البدء بتجهيز المخطط البياني لأول مرة عند فتح الصفحة
initChart();

// زر الإطلاق 🚀
document.getElementById('launch-btn').addEventListener('click', () => {
    if (isFlying) return;

    const v0 = parseFloat(document.getElementById('v0').value);
    const thetaRad = THREE.MathUtils.degToRad(parseFloat(document.getElementById('theta').value));
    const phiRad = THREE.MathUtils.degToRad(parseFloat(document.getElementById('phi').value));
    const rpmBack = parseFloat(document.getElementById('omegaBack').value);
    const rpmSide = parseFloat(document.getElementById('omegaSide').value);

    // تصفير المواقع والمتغيرات الزمنية والمخططات
    pos = { x: 0, y: 0, z: 0 };
    timeElapsed = 0;
    graphics.clearTrajectory();
    initChart(); 

    // ربط المحاور الفيزيائية (التقرير: Z للأعلى | Three.js: Y للأعلى)
    vel.x = v0 * Math.cos(thetaRad) * Math.cos(phiRad);
    vel.y = v0 * Math.cos(thetaRad) * Math.sin(phiRad);
    vel.z = v0 * Math.sin(thetaRad);

    omega.x = 0;
    omega.y = -(rpmBack * 2 * Math.PI) / 60; // دوران خلفي سلبي لرفع ماغنوس
    omega.z = (rpmSide * 2 * Math.PI) / 60;

    isFlying = true;
    dashStatus.textContent = "في الهواء 🏌️‍♂️";
    dashStatus.style.color = "#ffaa00";
    console.log("انطلقت المحاكاة بالشروط الابتدائية المعطاة.");
});

// زر إعادة التعيين 🔄
document.getElementById('reset-btn').addEventListener('click', () => {
    isFlying = false;
    pos = { x: 0, y: 0, z: 0 };
    vel = { x: 0, y: 0, z: 0 };
    omega = { x: 0, y: 0, z: 0 };
    timeElapsed = 0;
    
    graphics.clearTrajectory();
    graphics.ballGroup.position.set(0, 0, 0);
    if(graphics.ballMesh) graphics.ballMesh.rotation.set(0,0,0);
    
    graphics.camera.position.set(-25, 12, 35);
    graphics.controls.target.set(0,0,0);

    dashAlt.textContent = "0.00";
    dashVel.textContent = "0.00";
    dashDist.textContent = "0.00";
    dashStatus.textContent = "جاهزة";
    dashStatus.style.color = "#ffaa00";
    initChart();
});

// حلقة التحريك والرسم الرئيسي المستمر
function animate() {
    requestAnimationFrame(animate);

    // قمنا بوضع كود التحديث والحسابات الرياضية داخل هذا الشرط الصارم لضمان عدم حدوث تصفير للقيم عند التوقف الثابت للكرة
    if (isFlying) {
        // 1. معالجة الخطوة الزمنية الفيزيائية لحلال المعادلات والتصادمات
        solveRK4(pos, vel, omega, h);
        handleCollisions(pos, vel, omega);
        timeElapsed += h;

        // 2. تحديث وتوصيل الإحداثيات البصرية ثلاثية الأبعاد
        const visualPos = new THREE.Vector3(pos.x, pos.z, -pos.y);
        graphics.ballGroup.position.copy(visualPos);

        // 3. تغذية خط المسار المنقط بالنقاط الآنية للحركة
        graphics.appendTrajectoryPoint(visualPos.x, visualPos.y, visualPos.z);

        // 4. دوران مجسم الكرة حول محاوره الدورانية الفعلية
        if (graphics.ballMesh) {
            graphics.ballMesh.rotation.x += omega.y * h;
            graphics.ballMesh.rotation.y += omega.z * h;
        }

        // 5. تفعيل الكاميرا التتبعية الديناميكية خلف الكرة
        graphics.updateCameraFollow(visualPos);

        // 6. حساب السرعة الكلية وتغذية العدادات الرقمية اللحظية
        const currentSpeed = Math.sqrt(vel.x**2 + vel.y**2 + vel.z**2);
        dashAlt.textContent = pos.z.toFixed(2);
        dashVel.textContent = currentSpeed.toFixed(2);
        dashDist.textContent = pos.x.toFixed(2);

        // 7. تغذية المخطط البياني بالبيانات كل إطارين (لتوفير الأداء والسرعة)
        if (Math.round(timeElapsed / h) % 2 === 0) {
            chartLabels.push(timeElapsed.toFixed(2));
            chartAltData.push(pos.z);
            chartVelData.push(currentSpeed);
            chartInstance.update('none'); // تحديث صامت سريع بدون أنيميشن مفرط
        }

        // تحديث مسمى الحالة الرقمية في الواجهة
        if (pos.z === 0 && currentSpeed > 0.05) {
            dashStatus.textContent = "تتدحرج على العشب 🌿";
            dashStatus.style.color = "#52b788";
        }

        // الشرط الحاسم: عند التوقف التام، نثبت القيم النهائية فوراً ونمنع تصفيرها أو تداخلها
        if (vel.x === 0 && vel.y === 0 && vel.z === 0) {
            isFlying = false; // يخرج من كتلة الـ if الكبرى فتبقى جميع الأرقام ثابتة في الواجهة والمخطط
            dashStatus.textContent = "مستقرة وناجحة 🎯";
            dashStatus.style.color = "#00ffcc";
            
            // تحديث أخير وشامل للمخطط البياني لإظهار المنحنى الكامل ثابتاً ومكتملاً للجنة التحكيم
            chartInstance.update();
            console.log("تم التوقف وتثبيت القيم بنجاح. المسافة الكلية المحققة:", pos.x.toFixed(2), "متر");
        }
    }

    graphics.controls.update();
    graphics.renderer.render(graphics.scene, graphics.camera);
}

animate();