use std::collections::VecDeque;

use crate::log;

use crate::utils::{Note, SheetNote};
pub static TIME_SEGMENT_DURATION_MS: f32 = 2048.0 / 48000.0 * 1000.0;
const QUERY_CAPACITY: usize = 50; // ~2 s of slices
const ACCEPT_THRESHOLD: f64 = 1.5; // avg cost/slice; calibrated in tests
const TRACK_THRESHOLD: f64 = 0.9; // silence (1.0) and wrong notes must not advance
const SLACK: usize = 2; // drift tolerance (in slices) while tracking
const RECOVER_AFTER: u32 = 5; // failed tracking ticks before free-start re-acquisition

pub struct NoteTrack {
    notes_track: Vec<SheetNote>,
    features: Vec<Vec<Note>>,
    query: VecDeque<Vec<Note>>, // rolling query window
    last_position: Option<usize>,
    query_head: usize, // first query slice not yet consumed by tracking
    frozen_count: u32, // consecutive tracking rejections
}
impl NoteTrack {
    pub fn new() -> Self {
        NoteTrack {
            notes_track: Vec::new(),
            features: Vec::new(),
            query: VecDeque::new(),
            last_position: None,
            query_head: 0,
            frozen_count: 0,
        }
    }
    pub fn add_track(&mut self, track: &[SheetNote]) {
        self.notes_track.extend(track.iter().copied());
        self.query.clear();
        self.query_head = 0;
        self.frozen_count = 0;
        self.last_position = None;
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
            self.query_head = self.query_head.saturating_sub(1);
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
        log(&format!(
            "Best accept: {} best j: {}",
            best_cost.to_string(),
            best_j.to_string()
        )); // DEBUG
        (best_cost <= ACCEPT_THRESHOLD).then_some(best_j - 1)
    }
    pub fn match_position(&mut self) -> Option<u32> {
        let position = match self.last_position {
            None => self.acquire()?,
            Some(pos) => {
                let tail: Vec<Vec<Note>> =
                    self.query.iter().skip(self.query_head).cloned().collect();
                if tail.is_empty() {
                    return None;
                }
                let n = tail.len();
                let lo = pos.saturating_sub(SLACK);
                let hi = (pos + n + SLACK).min(self.features.len());
                if lo >= hi {
                    return None;
                }
                let fits = Self::forward_fit(&tail, &self.features[lo..hi], pos - lo);
                self.query_head = self.query.len();
                if !fits {
                    self.frozen_count += 1;
                    if self.frozen_count >= RECOVER_AFTER {
                        self.last_position = None; // fall back to free-start acquisition
                    }
                    return None; // freeze: silence or wrong note
                }
                self.frozen_count = 0;
                pos + n
            }
        };
        self.last_position = Some(position);
        Some((position as f32 * TIME_SEGMENT_DURATION_MS) as u32)
    }
    fn acquire(&mut self) -> Option<usize> {
        let j = Self::dtw(&self.query, &self.features)?;
        self.query_head = self.query.len();
        Some(j)
    }
    fn forward_fit(tail: &[Vec<Note>], window: &[Vec<Note>], start: usize) -> bool {
        let (n, m) = (tail.len(), window.len());
        if n == 0 || m == 0 {
            return false;
        }
        let mut d = vec![vec![f64::INFINITY; m + 1]; n + 1];
        // Bounded free start around the expected position: tolerates small drift
        // (performer slightly ahead/behind) without allowing backtracking.
        for j in 0..=m {
            let distance = (j as isize - (start as isize + 1)).abs() as usize;
            if distance <= SLACK {
                d[0][j] = 0.0;
            }
        }
        for i in 1..=n {
            for j in 1..=m {
                let c = crate::utils::dtw_cost(&tail[i - 1], &window[j - 1]);
                d[i][j] = c + d[i - 1][j - 1].min(d[i - 1][j]).min(d[i][j - 1]);
            }
        }
        let end_lo = (start + n).saturating_sub(SLACK);
        let end_hi = (start + n + SLACK).min(m);
        let mut best_cost = f64::INFINITY;
        for j in end_lo..=end_hi {
            best_cost = best_cost.min(d[n][j] / n as f64);
        }
        log(&format!("Track fit: {}", best_cost.to_string())); // DEBUG
        best_cost <= TRACK_THRESHOLD
    }
    pub fn note_at_time_ms(&self, time_ms: u32) -> Option<&SheetNote> {
        self.notes_track
            .iter()
            .find(|n| time_ms >= n.start_time_ms && time_ms < n.end_time_ms)
    }
}
