function calculateEnginePerformance(inputs) {
  // Constants
  const gamma_air = 1.4;
  const gamma_gas = 1.333;
  const cp_air = 1005; // J/kg·K
  const cp_gas = 1148; // J/kg·K (hot gas)
  const R = 287; // J/kg·K
  const fuel_heating_value = 43.1e6; // J/kg (kero)

  const inlet_area = 1.0; // m^2
  const eta_inlet = 0.98;
  const pi_c = 12.0;          // compressor pressure ratio (OPR)
  const eta_c = 0.90;        // compressor isentropic eff
  const eta_b = 0.99;        // combustor efficiency (combustion completeness)
  const pi_b = 0.96;         // combustor pressure loss factor
  const eta_t = 0.92;        // turbine isentropic eff
  const eta_n = 0.98;        // nozzle efficiency

  // Get atmosphere
  const atm = getAtmosphere(inputs.altitude);
  const p0 = atm.pressure;
  const t0 = atm.temperature;
  const rho0 = atm.rho;

  // Freestream speed
  const a0 = Math.sqrt(gamma_air * R * t0);
  const v0 = Math.max(0, inputs.mach * a0);

  // Station 2 (after inlet/diffuser)
  const t02 = t0 * (1 + (gamma_air - 1) / 2 * Math.pow(inputs.mach, 2));
  const p02 = p0 * Math.pow(t02 / t0, gamma_air / (gamma_air - 1));
  const p02_real = p02 * eta_inlet;

  // Mass flow (steady approximation, ideal inlet)
  // m_dot = rho * V * A
  const m_dot_air = inlet_area * rho0 * v0;

  // Compressor outlet station 3
  const t03_ideal = t02 * Math.pow(pi_c, (gamma_air - 1) / gamma_air);
  const t03 = t02 + (t03_ideal - t02) / eta_c;
  const p03 = p02_real * pi_c;

  // Compressor power (W)
  const compressor_work = m_dot_air * cp_air * (t03 - t02);

  // Station 4 combustor outlet (turbine inlet)
  // inputs.t04 must be provided (K)
  const t04 = inputs.t04;
  const p04 = p03 * pi_b;

  // Fuel-air ratio (stoichiometric energy balance)
  // (m_f/m_a) * Q * eta_b = m_a*cp_gas*(t04 - t03) + ... approximate
  // Solving for m_f/m_a
  // Avoid division by zero
  const denom = eta_b * fuel_heating_value - cp_gas * t04;
  let fuel_air_ratio = 0;
  if (denom > 1e3) {
    fuel_air_ratio = (cp_gas * t04 - cp_air * t03) / denom;
  } else {
    fuel_air_ratio = 0; // can't burn — limit
  }
  if (fuel_air_ratio < 0) fuel_air_ratio = 0;

  const m_dot_fuel = fuel_air_ratio * m_dot_air;
  const m_dot_hot = m_dot_air + m_dot_fuel;

  // Turbine work (assume turbine supplies compressor work)
  const turbine_work = compressor_work;
  // t05 from energy balance: turbine_work = m_dot_hot * cp_gas * (t04 - t05)
  let t05 = t04;
  if (m_dot_hot * cp_gas > 1e-6) {
    t05 = t04 - turbine_work / (m_dot_hot * cp_gas);
  }
  // isentropic temperature drop estimate for turbine -> p05
  const t05_ideal = t04 - (t04 - t05) / eta_t; // invert eff
  const p05 = p04 * Math.pow(t05_ideal / t04, gamma_gas / (gamma_gas - 1));

  // Nozzle exit (station 8)
  const p8 = p0; // ideally expanded to ambient
  // ideal expansion temperature
  let t8_ideal = t05 * Math.pow(p8 / p05, (gamma_gas - 1) / gamma_gas);
  let t8 = t05 - eta_n * (t05 - t8_ideal);
  if (t05 - t8 < 0) t8 = t05; // guard

  const v8 = Math.sqrt(Math.max(0, 2 * cp_gas * (t05 - t8)));

  // Performance
  const thrust_gross = m_dot_hot * v8;   // N
  const thrust_ram = m_dot_air * v0;
  const thrust_net = thrust_gross - thrust_ram; // N

  // TSFC in g/kN·s: (m_fuel [kg/s]) / (thrust [kN]) in kg/(kN·s) then *1000 to g
  let tsfc_si = 0;
  const thrust_kN = thrust_net / 1000;
  if (Math.abs(thrust_kN) > 1e-6) {
    tsfc_si = (m_dot_fuel / thrust_kN) * 1000; // g/kN·s
  } else {
    tsfc_si = 1e6; // very large to indicate invalid operating point
  }

  // Compose station entropies (relative)
  // S = cp ln(T2/T1) - R ln(P2/P1)
  const s2 = 0;
  const s3 = cp_air * Math.log(Math.max(1e-9, t03 / t02)) - R * Math.log(Math.max(1e-9, p03 / p02_real));
  const s4 = cp_air * Math.log(Math.max(1e-9, t04 / t03)) - R * Math.log(Math.max(1e-9, p04 / p03));
  const s5 = s4 + cp_gas * Math.log(Math.max(1e-9, t05 / t04)) - R * Math.log(Math.max(1e-9, p05 / p04));

  // Results
  return {
    performance: {
      thrust: thrust_net,
      tsfc: tsfc_si,
      air_flow: m_dot_air,
      fuel_flow: m_dot_fuel
    },
    stations: {
      s0: { T: t0, P: p0, S: 0 },
      s2: { T: t02, P: p02_real, S: s2 },
      s3: { T: t03, P: p03, S: s3 },
      s4: { T: t04, P: p04, S: s4 },
      s5: { T: t05, P: p05, S: s5 }
    },
    design: {
      pi_c: pi_c, cp_air: cp_air, cp_gas: cp_gas
    }
  };
}
