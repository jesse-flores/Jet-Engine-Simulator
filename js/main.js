// Main UI glue
document.addEventListener('DOMContentLoaded', () => {
    // --- UI elements ---
    const altitudeSlider = document.getElementById('altitudeSlider');
    const machSlider = document.getElementById('machSlider');
    const altitudeValue = document.getElementById('altitudeValue');
    const machValue = document.getElementById('machValue');

    const pedal = document.getElementById('pedal');
    const pedalContainer = document.getElementById('pedalContainer');
    const throttlePctEl = document.getElementById('throttlePct');
    const t04ValueEl = document.getElementById('t04Value');

    const thrustOutputEl = document.getElementById('thrustOutput');
    const tsfcOutputEl = document.getElementById('tsfcOutput');
    const airFlowOutputEl = document.getElementById('airFlowOutput');
    const fuelFlowOutputEl = document.getElementById('fuelFlowOutput');
    const oprOutputEl = document.getElementById('oprOutput');
    const t04OutputEl = document.getElementById('t04Output');

    const flameGroup = document.getElementById('flameGroup');
    const flameOuter = document.getElementById('flameOuter');
    const flameMid = document.getElementById('flameMid');
    const flameCore = document.getElementById('flameCore');
    const turbine = document.getElementById('turbine');

    // default inputs
    const inputs = {
    altitude: parseFloat(altitudeSlider.value),
    mach: parseFloat(machSlider.value),
    throttle_pct: 50, // pedal 0-100
    t04_min: 800,
    t04_max: 1800
  };

  // Utility: map pedal pct to turbine inlet temp
  function throttlePctToT04(pct) {
    return inputs.t04_min + (pct / 100) * (inputs.t04_max - inputs.t04_min);
  }

  // initialize displayed values
  altitudeValue.textContent = inputs.altitude;
  machValue.textContent = inputs.mach.toFixed(2);

  // --- Chart.js setups ---
  // Basic dark theme defaults
  Chart.defaults.color = '#dbeeff';
    Chart.defaults.font.family = 'Inter, Arial';
    

  // T-s Chart (line)
  const tsCtx = document.getElementById('tsChart').getContext('2d');
  const tsChart = new Chart(tsCtx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Real Cycle',
        data: [],
        borderColor: '#ff7a18',
        backgroundColor: 'rgba(255,122,24,0.12)',
        tension: 0.2,
        fill: true,
        pointRadius: 4
      }]
    },
    options: {
      scales: {
        x: { title: { display: true, text: 'Relative Entropy (arb)' } },
        y: { title: { display: true, text: 'Total Temperature (K)' } }
      },
      plugins: { legend: { display: true } }
    }
  });

  // P-T chart (bar with two axes)
  const ptCtx = document.getElementById('ptChart').getContext('2d');
  const ptChart = new Chart(ptCtx, {
    type: 'bar',
    data: {
      labels: ['Ambient', 'Inlet S2', 'Compressor S3', 'Combustor S4', 'Turbine S5'],
      datasets: [
        { label: 'Total Pressure (kPa)', data: [], backgroundColor: '#1f77b4', yAxisID: 'y1' },
        { label: 'Total Temp (K)', data: [], backgroundColor: '#ff7a18', yAxisID: 'y2' }
      ]
    },
    options: {
      scales: {
        y1: { type: 'linear', position: 'left', title: { display: true, text: 'Pressure (kPa)' } },
        y2: { type: 'linear', position: 'right', title: { display: true, text: 'Temperature (K)' }, grid: { drawOnChartArea: false } }
      }
    }
  });

  // Thrust vs Mach chart
  const thrustMachCtx = document.getElementById('thrustMachChart').getContext('2d');
  const thrustMachChart = new Chart(thrustMachCtx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Thrust (kN)', data: [], borderColor: '#8ad2ff', backgroundColor: 'rgba(138,210,255,0.08)', tension:0.2 }] },
    options: { scales: { x: { title: { display: true, text: 'Mach' } }, y: { title: { display: true, text: 'Thrust (kN)' } } } }
  });

  // TSFC vs Mach chart
  const tsfcMachCtx = document.getElementById('tsfcMachChart').getContext('2d');
  const tsfcMachChart = new Chart(tsfcMachCtx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'TSFC (g/kN·s)', data: [], borderColor: '#ffd76a', backgroundColor: 'rgba(255,215,106,0.08)' }] },
    options: { scales: { x: { title: { display: true, text: 'Mach' } }, y: { title: { display: true, text: 'TSFC (g/kN·s)' } } } }
  });

  // Fuel vs Throttle chart
  const fuelThrottleCtx = document.getElementById('fuelThrottleChart').getContext('2d');
  const fuelThrottleChart = new Chart(fuelThrottleCtx, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'Fuel Flow (kg/s)', data: [], borderColor: '#ff7a7a', backgroundColor: 'rgba(255,122,122,0.08)' }] },
    options: { scales: { x: { title: { display: true, text: 'Throttle %' } }, y: { title: { display: true, text: 'Fuel Flow (kg/s)' } } } }
  });

  // --- UI interaction: sliders and pedal ---
  altitudeSlider.addEventListener('input', (e) => {
    inputs.altitude = parseFloat(e.target.value);
    altitudeValue.textContent = inputs.altitude;
    queueUpdate();
  });

  machSlider.addEventListener('input', (e) => {
    inputs.mach = parseFloat(e.target.value);
    machValue.textContent = inputs.mach.toFixed(2);
    queueUpdate();
  });

  // Pedal dragging
  let dragging = false;
  pedal.addEventListener('mousedown', (ev) => { dragging = true; pedal.style.cursor='grabbing'; ev.preventDefault(); });
  document.addEventListener('mouseup', () => { dragging = false; pedal.style.cursor='grab'; });
  document.addEventListener('mousemove', (ev) => {
    if (!dragging) return;
    const rect = pedalContainer.getBoundingClientRect();
    // compute y relative to container, clamp
    let y = ev.clientY - rect.top;
    const pad = 10;
    y = Math.max(pad, Math.min(rect.height - pad - pedal.offsetHeight, y - pedal.offsetHeight/2));
    // bottom coordinate mapped to 0%
    const pct = 100 * (1 - (y - pad) / (rect.height - 2*pad - pedal.offsetHeight));
    inputs.throttle_pct = Math.max(0, Math.min(100, pct));
    updatePedalUI();
    queueUpdate();
  });

  // clicking inside container sets position
  pedalContainer.addEventListener('click', (ev) => {
    const rect = pedalContainer.getBoundingClientRect();
    let y = ev.clientY - rect.top;
    const pad = 10;
    y = Math.max(pad, Math.min(rect.height - pad - pedal.offsetHeight, y - pedal.offsetHeight/2));
    const pct = 100 * (1 - (y - pad) / (rect.height - 2*pad - pedal.offsetHeight));
    inputs.throttle_pct = Math.max(0, Math.min(100, pct));
    updatePedalUI();
    queueUpdate();
  });

  function updatePedalUI() {
    // position pedal visually
    const rect = pedalContainer.getBoundingClientRect();
    const pad = 10;
    const available = rect.height - 2*pad - pedal.offsetHeight;
    const y = pad + (1 - inputs.throttle_pct/100) * available;
    pedal.style.top = `${y}px`;
    throttlePctEl.textContent = `${Math.round(inputs.throttle_pct)}%`;

    const t04 = throttlePctToT04(inputs.throttle_pct);
    t04ValueEl.textContent = Math.round(t04);
  }

  // Init pedal position
  updatePedalUI();

  // --- Visual update loop (turbine spin & flame flicker) ---
  let turbineAngle = 0;
  function animateVisuals() {
    // turbine spin rate depends on throttle_pct (and on computed turbine energy we could use)
    const spinRate = 0.5 + inputs.throttle_pct / 2; // degrees per RAF tick
    turbineAngle = (turbineAngle + spinRate) % 360;
    turbine.setAttribute('transform', `translate(470,120) scale(1) rotate(${turbineAngle})`);

    // flame color & scale based on Tt4 (computed during sim update)
    requestAnimationFrame(animateVisuals);
  }
  requestAnimationFrame(animateVisuals);

  // --- throttled updates (avoid spamming heavy chart redraws) ---
  let updateRequested = false;
  function queueUpdate() {
    if (!updateRequested) {
      updateRequested = true;
      window.setTimeout(() => {
        updateRequested = false;
        runSimulationAndUpdateUI();
      }, 80);
    }
  }

  // Run initial simulation
  runSimulationAndUpdateUI();

  // --- Core simulation + UI update function ---
  function runSimulationAndUpdateUI() {
    // Map pedal pct to Tt4 (K)
    const t04 = throttlePctToT04(inputs.throttle_pct);
    const simInputs = {
      altitude: inputs.altitude,
      mach: inputs.mach,
      t04: t04
    };

    // Call engine model
    const results = calculateEnginePerformance(simInputs);
    const perf = results.performance;
    const stations = results.stations;

    // Outputs to UI (format nicely)
    thrustOutputEl.textContent = (perf.thrust / 1000).toFixed(2); // kN
    tsfcOutputEl.textContent = isFinite(perf.tsfc) ? perf.tsfc.toFixed(2) : '—';
    airFlowOutputEl.textContent = perf.air_flow.toFixed(2);
    fuelFlowOutputEl.textContent = perf.fuel_flow.toExponential(3);
    oprOutputEl.textContent = results.design.pi_c.toFixed(2);
    t04OutputEl.textContent = Math.round(t04);

    // Update T-s chart (use stations s2..s5)
    const tsData = [
      { x: stations.s2.S, y: stations.s2.T },
      { x: stations.s3.S, y: stations.s3.T },
      { x: stations.s4.S, y: stations.s4.T },
      { x: stations.s5.S, y: stations.s5.T },
      { x: stations.s2.S, y: stations.s2.T } // close loop
    ];
    tsChart.data.datasets[0].data = tsData;
    tsChart.update('none');

    // Update P-T chart
    ptChart.data.datasets[0].data = [
      stations.s0.P / 1000,
      stations.s2.P / 1000,
      stations.s3.P / 1000,
      stations.s4.P / 1000,
      stations.s5.P / 1000
    ];
    ptChart.data.datasets[1].data = [
      stations.s0.T,
      stations.s2.T,
      stations.s3.T,
      stations.s4.T,
      stations.s5.T
    ];
    ptChart.update('none');

    // Visual flame: color mapping by throttle and t04
    updateFlameVisual(t04, inputs.throttle_pct);

    // Recompute sweep charts (vectorized)
    updateSweepCharts(simInputs);
  }

  // update flame visuals (size + color + opacity)
  function updateFlameVisual(t04, pct) {
  const scale = 0.6 + (pct / 100) * 1.4;
  flameGroup.setAttribute(
    'transform',
    `translate(450,120) scale(${scale},${scale / 1.5})`
  );

  // Core color mapping
  let coreColor = '#4db8ff';
  if (pct < 33) coreColor = '#4db8ff';
  else if (pct < 66) coreColor = '#ffcc66';
  else coreColor = '#ff7a18';

  flameCore.setAttribute('fill', coreColor);
  flameCore.setAttribute('opacity', `${0.35 + pct / 150}`);
}


  // Sweep charts: thrust vs Mach, TSFC vs Mach, fuel vs throttle
  function updateSweepCharts(simInputs) {
    // Mach sweep
    const machs = [];
    const thrusts = [];
    const tsfcs = [];
    const machMin = 0.0, machMax = 2.5, machStep = 0.05;
    for (let m = machMin; m <= machMax + 1e-9; m += machStep) {
      machs.push(parseFloat(m.toFixed(2)));
      const inpt = { altitude: simInputs.altitude, mach: m, t04: simInputs.t04 };
      const r = calculateEnginePerformance(inpt);
      thrusts.push( +(r.performance.thrust / 1000).toFixed(3) ); // kN
      tsfcs.push( isFinite(r.performance.tsfc) ? +r.performance.tsfc.toFixed(3) : null );
    }
    thrustMachChart.data.labels = machs;
    thrustMachChart.data.datasets[0].data = thrusts;
    thrustMachChart.update('none');

    tsfcMachChart.data.labels = machs;
    tsfcMachChart.data.datasets[0].data = tsfcs;
    tsfcMachChart.update('none');

    // Fuel vs throttle sweep (0..100)
    const thrLabels = [];
    const fuelVals = [];
    for (let p = 0; p <= 100; p += 2) {
      const t04 = throttlePctToT04(p);
      const r = calculateEnginePerformance({ altitude: simInputs.altitude, mach: simInputs.mach, t04: t04 });
      thrLabels.push(p);
      fuelVals.push(+r.performance.fuel_flow.toFixed(5));
    }
    fuelThrottleChart.data.labels = thrLabels;
    fuelThrottleChart.data.datasets[0].data = fuelVals;
    fuelThrottleChart.update('none');
  }

  // small helper to map throttle pct to t04
  function throttlePctToT04(pct) {
    return inputs.t04_min + (pct/100) * (inputs.t04_max - inputs.t04_min);
  }
});
