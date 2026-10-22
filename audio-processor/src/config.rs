use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioConfig {
	pub sample_rate : f64,
	pub fft_size: usize,
	pub window_size: usize,
	pub hop_size: usize,
	pub window_function: WindowFunction,

	pub pitch_algorithm: PitchAlgorithm,
	pub min_frequency: f64,
	pub max_frequency: f64,
	pub magnitude_threshold: f64,
	pub max_harmonic_divisor: usize,
	pub subharmonic_threshold: f64,

	pub query_capacity: usize,
	pub accept_threshold: f64,
	pub track_threshold: f32,
	pub slack: usize,
	pub recover_after: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum WindowFunction {
	Rectangular,
	Hann,
	Hamming,
	Blackman,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum PitchAlgorithm {
	FftPeak,
	FftHarmonics,
	Hps,
	Yin,
}

impl Default for AudioConfig {
	fn default() -> Self {
		Self {
			sample_rate: 48000.0,
			fft_size: 2048,
			window_size: 2048,
			hop_size: 512,
			window_function: WindowFunction::Hann,

			pitch_algorithm: PitchAlgorithm::FftPeak,
			min_frequency: 60.0,
			max_frequency: 2000.0,
			magnitude_threshold: 10.0,
			max_harmonic_divisor: 4,
			subharmonic_threshold: 0.5,

			query_capacity: 50,
			accept_threshold: 1.5,
			track_threshold: 0.9,
			slack: 2,
			recover_after: 2,
		}
	}
}

impl AudioConfig {
	pub fn validate(&self) -> Result<(), String> {
		if self.sample_rate == 0.0 {
			return Err("Sample rate must be greater that zero".into());
		}

		if self.fft_size == 0 || !self.fft_size.is_power_of_two() {
			return Err("FFT size must be a power of two".into());
		} 

		if self.window_size == 0 || self.window_size > self.fft_size {
			return Err("Invalid window size".into());
		}

		if self.hop_size == 0 || self.hop_size > self.window_size {
			return Err("Invalid hop size".into());
		}

		if self.min_frequency <= 0.0
			|| self.max_frequency <= self.min_frequency
			|| self.max_frequency >= self.sample_rate as f64 / 2.0 {
			return Err("Invalid frequency range".into());
		}

		Ok(())
	}
}
