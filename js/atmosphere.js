function getAtmosphere(altitude_ft) {
  const altitude_m = altitude_ft * 0.3048;
  const T0 = 288.15;
  const P0 = 101325;
  const g0 = 9.80665;
  const R = 287.058;

  let temperature, pressure;

  if (altitude_m <= 11000) {
    const lapse = -0.0065;
    temperature = T0 + lapse * altitude_m;
    pressure = P0 * Math.pow(temperature / T0, -g0 / (lapse * R));
  } else {
    // simple stratosphere piecewise
    temperature = 216.65;
    const P11 = 22632.1;
    pressure = P11 * Math.exp((-g0 * (altitude_m - 11000)) / (R * temperature));
  }

  const rho = pressure / (R * temperature);
  return { pressure: pressure, temperature: temperature, rho: rho };
}


// TO-DO: Finish particle animation
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');


function resizeCanvas() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

class Particle {
    constructor(x, y) {
        this.reset(x, y);
    }

    reset(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 4 + 2;
        this.alpha = 2;
        this.speedX = (Math.random() - 0.5) * 1.3;
        this.speedY = -Math.random() * 5 - 1;
        this.fade = 0.01 + Math.random() * 0.2;
    }

    update() {
        this.y += this.speedX;
        this.x += this.speedY;
        this.alpha -= this.fade;
        if (this.alpha <= 0) {
            // Respawn near exhaust area
            this.reset(canvas.width * 0.7-60, canvas.height * 0.5-5);
        }
    }

    draw(ctx) {
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

const particles = [];
for (let i = 0; i < 80; i++) {
    particles.push(new Particle(canvas.width * 0.7, canvas.height * 0.5));
}

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let p of particles) {
        p.update();
        p.draw(ctx);
    }
    requestAnimationFrame(animateParticles);
}

animateParticles();
