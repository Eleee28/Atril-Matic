use std::collections::VecDeque;

use crate::utils::{Note, SheetNote};
pub static TIME_SEGMENT_DURATION_MS: f32 = 2048.0 / 48000.0 * 1000.0;
const QUERY_CAPACITY: usize = 50; // ~2 s of slices
const WINDOW_HALF: usize = 75; // ref window ±3 s around last position
const ACCEPT_THRESHOLD: f64 = 1.0; // avg cost/slice; calibrated in tests

pub struct NoteTrack {
    notes_track: Vec<SheetNote>,
    features: Vec<Vec<Note>>,
    query: VecDeque<Vec<Note>>, // rolling query window
    last_position: Option<usize>,
}
impl NoteTrack {
    pub fn new() -> Self {
        NoteTrack {
            notes_track: Vec::new(),
            features: Vec::new(),
            query: VecDeque::new(),
            last_position: None,
        }
    }
    pub fn add_track(&mut self, track: &[SheetNote]) {
        self.notes_track.extend(track.iter().copied());
        let max_end_time = track.iter().map(|a| a.end_time_ms).max().unwrap_or(0) as f32;
        let total_slices = (max_end_time / TIME_SEGMENT_DURATION_MS) as usize + 1;
        self.features = Vec::with_capacity(total_slices);
        for slice in 0..total_slices {
            let window_start = slice as f32 * TIME_SEGMENT_DURATION_MS;
            let window_end = (slice + 1) as f32 * TIME_SEGMENT_DURATION_MS;
            let window_notes: Vec<Note> = track
                .iter()
                .filter(|p| {
                    let start = p.start_time_ms as f32;
                    let end = p.end_time_ms as f32;
                    start < window_end && end >= window_start
                })
                .map(|p| p.note)
                .collect();
            self.features.push(window_notes);
        }
    }
    pub fn push_query_slice(&mut self, notes: Vec<Note>) {
        if self.query.len() == QUERY_CAPACITY {
            self.query.pop_front();
        }
        self.query.push_back(notes);
    }
    fn dtw(query: &VecDeque<Vec<Note>>, reference: &[Vec<Note>]) -> Option<usize> {
        let (n, m) = (query.len(), reference.len());
        if n == 0 || m == 0 {
            return None;
        }

        let mut d = vec![vec![f64::INFINITY; m + 1]; n + 1];
        for j in 0..=m {
            d[0][j] = 0.0;
        } // free start

        for i in 1..=n {
            for j in 1..=m {
                let c = crate::utils::dtw_cost(&query[i - 1], &reference[j - 1]);
                d[i][j] = c + d[i - 1][j - 1].min(d[i - 1][j]).min(d[i][j - 1]);
            }
        }

        let (mut best_j, mut best_cost) = (1usize, d[n][1] / n as f64);
        for j in 2..=m {
            let avg = d[n][j] / n as f64; // open-end
            if avg < best_cost {
                best_cost = avg;
                best_j = j;
            }
        }
        (best_cost <= ACCEPT_THRESHOLD).then_some(best_j - 1)
    }
    pub fn match_position(&mut self) -> Option<u32> {
        let (lo, hi) = match self.last_position {
            Some(p) => (
                p.saturating_sub(WINDOW_HALF),
                (p + WINDOW_HALF).min(self.features.len()),
            ),
            None => (0, self.features.len()),
        };
        let j = Self::dtw(&self.query, &self.features[lo..hi])?;
        let abs = lo + j;
        self.last_position = Some(abs);
        Some((abs as f32 * TIME_SEGMENT_DURATION_MS) as u32)
    }
    pub fn note_at_time_ms(&self, time_ms: u32) -> Option<&SheetNote> {
        self.notes_track
            .iter()
            .find(|n| time_ms >= n.start_time_ms && time_ms < n.end_time_ms)
    }
}
