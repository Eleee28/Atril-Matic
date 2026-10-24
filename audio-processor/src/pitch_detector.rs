use log::debug;
use rustfft::num_traits::clamp;
use rustfft::{num_complex::Complex, FftPlanner};
use std::f64::consts::{PI, TAU};
use std::sync::Arc;
use wasm_bindgen::prelude::*;

use crate::config::{AudioConfig, PitchAlgorithm, WindowFunction};
use crate::utils::Note;

pub struct DetectedPitch {
    pub note: Note,
    pub frequency: Option<f64>,
    pub magnitude: f64,
}

#[wasm_bindgen]
pub struct PitchDetector {
    fft: Arc<dyn rustfft::Fft<f64>>,
    spectrum: Vec<Complex<f64>>,

    config: AudioConfig,
}

impl PitchDetector {
    pub fn new(config: AudioConfig) -> PitchDetector {
        let mut planner = FftPlanner::<f64>::new();
        let fft = planner.plan_fft_forward(config.fft_size);

        PitchDetector {
            fft,
            spectrum: vec![Complex::new(0.0, 0.0); config.fft_size],
            config,
        }
    }

    pub fn detect_pitch(&mut self, time_domain_data: &[u8]) -> Note {
        self.detect_pitch_details(time_domain_data).note
    }

    pub fn detect_pitch_details(&mut self, time_domain_data: &[u8]) -> DetectedPitch {
        // Convert byte data to float samples (0-255 to -1.0 to 1.0)
        let mut samples: Vec<f64> = time_domain_data
            .iter()
            .map(|&byte| (byte as f64 - 128.0) / 128.0)
            .collect();

        match self.config.pitch_algorithm {
            PitchAlgorithm::Yin => {
                if self.config.tau_max <= samples.len() / 2 {
                    let frequency = self.yin_detect(
                        self.config.tau_min,
                        self.config.tau_max,
                        self.config.yin_threshold,
                        &samples,
                    );
                    debug!("(YIN) frequency: {}hz ", frequency);
                    let (note_val, octave) = crate::utils::NoteValue::from_frequency(frequency);
                    return DetectedPitch {
                        note: Note {
                            note_value: Some(note_val),
                            octave,
                        },
                        frequency: Some(frequency),
                        magnitude: 1.0,
                    };
                } else {
                    return DetectedPitch {
                        note: Note {
                            note_value: None,
                            octave: 0,
                        },
                        frequency: None,
                        magnitude: 0.0,
                    };
                }
            }
            _ => {
                self.apply_window(&mut samples);

                let mut buffer: Vec<Complex<f64>> =
                    samples.iter().map(|&s| Complex::new(s, 0.0)).collect();

                self.fft.process(&mut buffer);

                self.spectrum = buffer;
                let (frequency, magnitude) = self.find_fundamental();
                debug!("frequency: {}hz magnitude:{}", frequency, magnitude);

                if magnitude < self.config.magnitude_threshold {
                    return DetectedPitch {
                        note: Note {
                            note_value: None,
                            octave: 0,
                        },
                        frequency: Some(frequency),
                        magnitude,
                    };
                }
                let (note_val, octave) = crate::utils::NoteValue::from_frequency(frequency);

                return DetectedPitch {
                    note: Note {
                        note_value: Some(note_val),
                        octave,
                    },
                    frequency: Some(frequency),
                    magnitude,
                };
            }
        }
    }
    fn apply_window(&self, samples: &mut [f64]) {
        let n = samples.len();
        for (i, sample) in samples.iter_mut().enumerate() {
            *sample *= Self::window_coefficient(&self.config.window_function, i, n);
        }
    }

    /* for reference (AI summary)
     * FFT Window Function Comparison Table
     * =====================================
     *
     * Window       | Coefficient Function (n = 0..N-1)                              | Main Lobe Width | Peak Side-Lobe | Roll-Off Rate
     * -------------|----------------------------------------------------------------|-----------------|----------------|---------------
     * Rectangular  | w(n) = 1                                                       | 4*pi/N          | -13 dB         | -6 dB/oct
     * Hann         | w(n) = 0.5 - 0.5*cos(2*pi*n/(N-1))                            | 8*pi/N          | -31.5 dB       | -18 dB/oct
     * Hamming      | w(n) = 0.54 - 0.46*cos(2*pi*n/(N-1))                          | 8*pi/N          | -42.7 dB       | -6 dB/oct
     * Blackman     | w(n) = 0.42 - 0.5*cos(2*pi*n/(N-1)) + 0.08*cos(4*pi*n/(N-1)) | 12*pi/N         | -58.1 dB       | -18 dB/oct
     *
     * Trade-off: smoother window shape => lower side-lobes (less leakage)
     *            but wider main lobe (lower frequency resolution).
     *
     * Rectangular : highest resolution, worst leakage; use for synchronous sampling.
     * Hann        : general-purpose, good side-lobe suppression.
     * Hamming     : best side-lobe suppression at same main lobe width as Hann.
     * Blackman    : lowest side-lobes, widest main lobe; high dynamic range analysis.
     */
    fn window_coefficient(function: &WindowFunction, index: usize, size: usize) -> f64 {
        match function {
            WindowFunction::Blackman => {
                0.42 - (0.5 * (2.0 * PI * index as f64 / (size as f64 - 1.0)).cos())
                    + 0.8 * (PI * index as f64 / (size as f64 - 1.0))
            }
            WindowFunction::Hamming => {
                0.54 - (0.46 * (2.0 * PI * index as f64 / (size as f64 - 1.0)).cos())
            }
            WindowFunction::Rectangular => 1.0,
            WindowFunction::Hann => {
                0.5 * (1.0 - (2.0 * PI * index as f64 / (size as f64 - 1.0)).cos())
            }
        }
    }
    fn yin_detect(&self, tau_min: usize, tau_max: usize, threshold: f64, samples: &[f64]) -> f64 {
        let w = samples.len();
        // Start by defining an array d which is the squared difference between a given sample
        // and that sample shifted by tau. At the true period the difference should be near zero, meaning
        // we found the frequency
        let mut d = vec![0.0f64; tau_max + 1];
        for tau in 1..=tau_max {
            let mut sum = 0.0;
            for j in 0..(w - tau) {
                let diff = samples[j] - samples[j + tau];
                sum += diff * diff;
            }
            d[tau] = sum;
        }
        //Cumulative mean normalized difference is in d' of dprime. This removes the bias towards
        // small lags (tau=0 difference is very good but useless to us)
        let mut d_prime = vec![0.0f64; tau_max + 1];
        d_prime[0] = 1.0;
        let mut running_sum = 0.0;
        for tau in 1..=tau_max {
            running_sum += d[tau];
            d_prime[tau] = if running_sum == 0.0 {
                1.0
            } else {
                (d[tau] * tau as f64) / running_sum
            };
        }
        // Pick the first dip below threshold  and is there isnt one pick the global minimum
        let mut tau_est: Option<usize> = None;
        for tau in tau_min..=tau_max {
            if d_prime[tau] < threshold {
                let mut t = tau;
                while t + 1 <= tau_max && d_prime[t + 1] < d_prime[t] {
                    t += 1;
                }
                tau_est = Some(t);
                break; // FIRST dip only
            }
        }
        let tau_est = match tau_est {
            Some(t) => t,
            None => {
                let mut best = tau_min;
                for tau in tau_min..=tau_max {
                    if d_prime[tau] < d_prime[best] {
                        best = tau;
                    }
                }
                best
            }
        };
        // the true period is maybe in between sample windows, adjust a parabole and iterpolate
        let tau_refined = if tau_est > tau_min && tau_est < tau_max {
            let a = d_prime[tau_est - 1];
            let b = d_prime[tau_est];
            let c = d_prime[tau_est + 1];
            let denom = a - 2.0 * b + c;
            if denom != 0.0 {
                let mut delta = 0.5 * (a - c) / denom;
                delta = delta.clamp(-0.5, 0.5);
                tau_est as f64 + delta
            } else {
                tau_est as f64
            }
        } else {
            tau_est as f64
        };

        //convert period to frequency
        if tau_refined <= 0.0 {
            0.0
        } else {
            self.config.sample_rate / tau_refined
        }
    }
    fn find_fundamental(&self) -> (f64, f64) {
        let bin_width = self.config.sample_rate / self.config.fft_size as f64;

        // Restrict the search to the vocal band. Skipping the sub-bass bins is
        // what stops drums/rumble (~20-60 Hz) from being detected as a note.
        let min_bin = (self.config.min_frequency / bin_width).floor().max(1.0) as usize;
        let max_bin =
            ((self.config.max_frequency / bin_width).ceil() as usize).min(self.config.fft_size / 2);
        match self.config.pitch_algorithm {
            PitchAlgorithm::Hps | PitchAlgorithm::HpsWithHarmonics => {
                let m: Vec<f64> = self.spectrum.iter().map(|c| c.norm()).collect();
                let n = m.len();
                // Q = 3: product spectrum length is floor(n/3) (or ceil, depending on step_by)
                let hps_len = n / 3;
                let mut best_index = 0usize;
                let mut best_hps_value = 0.0f64;

                let lo = min_bin.max(1);
                let hi = max_bin.min(hps_len);
                for i in lo..hi {
                    let v = m[i] * m[2 * i] * m[3 * i];
                    if v > best_hps_value {
                        best_hps_value = v;
                        best_index = i;
                    }
                }
                if best_hps_value <= 0.0 {
                    return (0.0, 0.0);
                }
                if self.config.pitch_algorithm == PitchAlgorithm::HpsWithHarmonics {
                    // Sub-harmonic correction: the FFT peak is often the 2nd or 3rd harmonic
                    // of the true fundamental (e.g. guitar sustain), so the reported note can
                    // be an octave (or more) above what was actually played. If a
                    // (near-)integer sub-multiple of the peak bin also carries strong energy,
                    // report that lower bin as the fundamental instead.
                    let best_bin_mag = m[best_index]; //magnitude fo the best bin and not hps value which are harmonic  bins multiplied
                    let mut best_sub_magnitude = 0.0;
                    let mut best_sub_bin = 0usize;
                    for k in 2..=self.config.max_harmonic_divisor {
                        let sub_bin = (best_index as f64 / k as f64).round() as usize;
                        if sub_bin < min_bin || sub_bin >= best_index {
                            continue;
                        }
                        let sub = self.spectrum[sub_bin].norm();
                        if sub > best_sub_magnitude {
                            best_sub_magnitude = sub;
                            best_sub_bin = sub_bin;
                        }
                    }
                    if best_sub_bin > 0
                        && best_sub_magnitude > best_bin_mag * self.config.subharmonic_threshold
                    {
                        return (best_sub_bin as f64 * bin_width, best_sub_magnitude);
                    }
                }
                (best_index as f64 * bin_width, best_hps_value)
            }
            _ => {
                let mut max_magnitude = 0.0;
                let mut max_index = 0;
                for i in min_bin..max_bin {
                    let magnitude = self.spectrum[i].norm();
                    if magnitude > max_magnitude {
                        max_magnitude = magnitude;
                        max_index = i;
                    }
                }

                if max_magnitude <= 0.0 {
                    return (0.0, 0.0);
                }

                if self.config.pitch_algorithm == PitchAlgorithm::FftPeakWithHarmonics {
                    // Sub-harmonic correction: the FFT peak is often the 2nd or 3rd harmonic
                    // of the true fundamental (e.g. guitar sustain), so the reported note can
                    // be an octave (or more) above what was actually played. If a
                    // (near-)integer sub-multiple of the peak bin also carries strong energy,
                    // report that lower bin as the fundamental instead.
                    let mut best_sub_magnitude = 0.0;
                    let mut best_sub_bin = 0usize;
                    for k in 2..=self.config.max_harmonic_divisor {
                        let sub_bin = (max_index as f64 / k as f64).round() as usize;
                        if sub_bin < min_bin || sub_bin >= max_index {
                            continue;
                        }
                        let sub = self.spectrum[sub_bin].norm();
                        if sub > best_sub_magnitude {
                            best_sub_magnitude = sub;
                            best_sub_bin = sub_bin;
                        }
                    }
                    if best_sub_bin > 0
                        && best_sub_magnitude > max_magnitude * self.config.subharmonic_threshold
                    {
                        return (best_sub_bin as f64 * bin_width, best_sub_magnitude);
                    }
                }

                (max_index as f64 * bin_width, max_magnitude)
            }
        }
    }

    /// Helper to get FFT size
    pub fn get_fft_size(&self) -> usize {
        self.config.fft_size
    }
}
