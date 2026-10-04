use audio_processor::utils::{Note, NoteValue};

pub const SAMPLE_RATE: f64 = 48_000.0;
pub const FFT_SIZE: usize = 2048;

pub fn sine_bytes(freq: f64, amplitude: f64, n: usize) -> Vec<u8> {
    (0..n)
        .map(|i| {
            let s = (2.0 * std::f64::consts::PI * freq * i as f64 / SAMPLE_RATE).sin() * amplitude;
            ((s + 1.0) * 127.5).round() as u8
        })
        .collect()
}

pub fn sum_sine_bytes(freqs: &[(f64, f64)], n: usize) -> Vec<u8> {
    let peak = freqs.iter().map(|(_, amp)| amp.abs()).sum::<f64>();
    let scale = if peak > 1.0 { 1.0 / peak } else { 1.0 };
    (0..n)
        .map(|i| {
            let s = freqs
                .iter()
                .map(|(freq, amp)| {
                    (2.0 * std::f64::consts::PI * freq * i as f64 / SAMPLE_RATE).sin() * amp * scale
                })
                .sum::<f64>();
            ((s + 1.0) * 127.5).round() as u8
        })
        .collect()
}

pub fn note(value: NoteValue, octave: i32) -> Note {
    Note {
        note_value: Some(value),
        octave,
    }
}

// pub fn init_logger() {
// 	let _ = env_logger::builder()
// 		.is_test(true)
// 		.try_init();
// }
