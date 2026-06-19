// الثوابت الميكانيكية والبيئية وفق الدراسة الفيزيائية
export const CONFIG = {
    g: 9.81,          // تسارع الجاذبية الأرضية [cite: 60]
    rho: 1.225,       // كثافة الهواء [cite: 67]
    mass: 0.0459,     // كتلة كرة الغولف القياسية (كغ) [cite: 59]
    radius: 0.02135,  // نصف قطر الكرة (متر) [cite: 70]
    CD: 0.22,         // معامل السحب (منخفض بسبب النتوءات الناتجة عن الـ dimples) [cite: 64, 66]
    CL_const: 0.2,    // معامل الرفع التقريبي لقوة ماغنوس [cite: 80]
    e_ground: 0.5,    // معامل ارتداد السطح [cite: 152]
    mu_k: 0.25,       // معامل الاحتكاك الديناميكي [cite: 152]
    mu_r: 0.015       // معامل احتكاك الدحرجة النقية [cite: 157]
};

const area = Math.PI * Math.pow(CONFIG.radius, 2); // مساحة المقطع العرضي للكرة [cite: 68, 69]

// دالة حساب التسارع اللحظي (مجموع القوى المترابطة تفاضلياً) [cite: 127]
function getAccelerations(vel, omega) {
    const vMag = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
    if (vMag === 0) return { ax: 0, ay: 0, az: -CONFIG.g };

    // 1. قوة مقاومة الهواء - السحب (Air Drag) [cite: 61]
    const F_drag = -0.5 * CONFIG.CD * CONFIG.rho * area * vMag; // [cite: 63]
    const fDx = (F_drag * vel.x) / vMag;
    const fDy = (F_drag * vel.y) / vMag;
    const fDz = (F_drag * vel.z) / vMag;

    // 2. قوة الرفع - ماغنوس (Magnus Effect) نتيجة الدوران [cite: 77, 78]
    let fLx = 0, fLy = 0, fLz = 0;
    const wMag = Math.sqrt(omega.x ** 2 + omega.y ** 2 + omega.z ** 2);
    
    if (wMag > 0) {
        const F_lift = 0.5 * CONFIG.CL_const * CONFIG.rho * area * vMag; // [cite: 79]
        // حساب الضرب التقاطعي لمتجه الدوران والسرعة الخطية (omega x vel) [cite: 79]
        const crossX = omega.y * vel.z - omega.z * vel.y;
        const crossY = omega.z * vel.x - omega.x * vel.z;
        const crossZ = omega.x * vel.y - omega.y * vel.x;
        const crossMag = Math.sqrt(crossX ** 2 + crossY ** 2 + crossZ ** 2);
        
        if (crossMag > 0) {
            fLx = (F_lift * crossX) / crossMag;
            fLy = (F_lift * crossY) / crossMag;
            fLz = (F_lift * crossZ) / crossMag;
        }
    }

    // قانون نيوتن الثاني: مجموع القوى مقسوماً على الكتلة [cite: 120]
    return {
        ax: (fDx + fLx) / CONFIG.mass,
        ay: (fDy + fLy) / CONFIG.mass,
        az: (-CONFIG.mass * CONFIG.g + fDz + fLz) / CONFIG.mass // الجاذبية للأسفل دائماً [cite: 57, 133]
    };
}

// مُحلّل المعادلات الرياضية بنظام التكامل العددي RK4 من المرتبة الرابعة [cite: 135]
export function solveRK4(pos, vel, omega, h) {
    // k1
    const a1 = getAccelerations(vel, omega);
    const k1_pos = { x: vel.x, y: vel.y, z: vel.z };
    const k1_vel = { x: a1.ax, y: a1.ay, z: a1.az };

    // k2
    const vel2 = { x: vel.x + 0.5 * h * k1_vel.x, y: vel.y + 0.5 * h * k1_vel.y, z: vel.z + 0.5 * h * k1_vel.z };
    const a2 = getAccelerations(vel2, omega);
    const k2_pos = { x: vel2.x, y: vel2.y, z: vel2.z };
    const k2_vel = { x: a2.ax, y: a2.ay, z: a2.az };

    // k3
    const vel3 = { x: vel.x + 0.5 * h * k2_vel.x, y: vel.y + 0.5 * h * k2_vel.y, z: vel.z + 0.5 * h * k2_vel.z };
    const a3 = getAccelerations(vel3, omega);
    const k3_pos = { x: vel3.x, y: vel3.y, z: vel3.z };
    const k3_vel = { x: a3.ax, y: a3.ay, z: a3.az };

    // k4
    const vel4 = { x: vel.x + h * k3_vel.x, y: vel.y + h * k3_vel.y, z: vel.z + h * k3_vel.z };
    const a4 = getAccelerations(vel4, omega);
    const k4_pos = { x: vel4.x, y: vel4.y, z: vel4.z };
    const k4_vel = { x: a4.ax, y: a4.ay, z: a4.az };

    // التحديث النهائي للموقع والسرعة الخطية بناءً على الأوزان الرياضية [cite: 143]
    pos.x += (h / 6) * (k1_pos.x + 2 * k2_pos.x + 2 * k3_pos.x + k4_pos.x);
    pos.y += (h / 6) * (k1_pos.y + 2 * k2_pos.y + 2 * k3_pos.y + k4_pos.y);
    pos.z += (h / 6) * (k1_pos.z + 2 * k2_pos.z + 2 * k3_pos.z + k4_pos.z);

    vel.x += (h / 6) * (k1_vel.x + 2 * k2_vel.x + 2 * k3_vel.x + k4_vel.x);
    vel.y += (h / 6) * (k1_vel.y + 2 * k2_vel.y + 2 * k3_vel.y + k4_vel.y);
    vel.z += (h / 6) * (k1_vel.z + 2 * k2_vel.z + 2 * k3_vel.z + k4_vel.z);

    // اضمحلال سرعة الدوران الزاوية تدريجياً بفعل الهواء المحوري
    omega.x *= 0.998;
    omega.y *= 0.998;
    omega.z *= 0.998;
}

// دالة معالجة الصدمات والارتداد السطحي وصولاً للدحرجة [cite: 149, 152]
export function handleCollisions(pos, vel, omega) {
    if (pos.z <= 0) { // شرط ملامسة الأرض [cite: 152]
        pos.z = 0;

        if (Math.abs(vel.z) > 0.1) {
            // الارتداد العمودي المماس لحساب سرعة ما بعد الاصطدام [cite: 152, 153]
            vel.z = -CONFIG.e_ground * vel.z; // [cite: 153]
            // تطبيق قوى الاحتكاك المماسية التي تبطئ المحاور الأفقية أثناء الصدمة [cite: 154]
            vel.x -= CONFIG.mu_k * (1 + CONFIG.e_ground) * Math.abs(vel.z) * Math.sign(vel.x); // [cite: 154]
            vel.y -= CONFIG.mu_k * (1 + CONFIG.e_ground) * Math.abs(vel.z) * Math.sign(vel.y); // [cite: 154]
        } else {
            // مرحلة الدحرجة النقية (Pure Rolling) [cite: 156, 160]
            vel.z = 0;
            const vH = Math.sqrt(vel.x ** 2 + vel.y ** 2);
            if (vH > 0.02) {
                // تباطؤ الاحتكاك التدحرجي المعاكس للحركة [cite: 157, 164]
                vel.x -= (CONFIG.mu_r * CONFIG.g * (vel.x / vH)) * 0.016; // [cite: 164]
                vel.y -= (CONFIG.mu_r * CONFIG.g * (vel.y / vH)) * 0.016; // [cite: 164]
            } else {
                // التوقف النهائي التام للكرة [cite: 162]
                vel.x = 0; vel.y = 0;
            }
        }
    }
}