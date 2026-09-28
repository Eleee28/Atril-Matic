use std::collections::{HashSet, VecDeque};

use crate::log;

use crate::utils::{dtw_cost, Note, SheetNote};
#[derive(Clone)]
pub struct NoteWindow {
    pub notes: Vec<Note>,
}
pub struct NoteTimeStamp {
    pub start_time_ms: u32,
    pub end_time_ms: u32,
}
pub const QUERY_CAPACITY: usize = 20;
pub const ACCEPT_THRESHOLD: f64 = 1.5;
pub const MAX_NOTE_FREEZES_BEFORE_READJUSTING: u32 = 2;
pub struct NoteTrack {
    notes_track: Vec<SheetNote>,
    processed_track: Vec<(NoteWindow, NoteTimeStamp)>,
    query: VecDeque<NoteWindow>, // rolling query window
    last_position: Option<usize>,
    query_head: usize, // first query slice not yet consumed by tracking
    frozen_count: u32, // consecutive tracking rejections
}
impl NoteTrack {
    pub fn new() -> Self {
        NoteTrack {
            notes_track: Vec::new(),
            processed_track: Vec::new(),
            query: VecDeque::new(),
            last_position: None,
            query_head: 0,
            frozen_count: 0,
        }
    }
    pub fn add_track(&mut self, track: &[SheetNote]) {
        //i assume the track is ordered by start time and is not empty
        self.notes_track.extend(track.iter().copied());
        self.query.clear();
        self.query_head = 0;
        self.frozen_count = 0;
        self.last_position = None;
        let mut windows = Vec::<(NoteWindow, NoteTimeStamp)>::new();
        let mut break_points = HashSet::new();
        for note in track {
            break_points.insert(note.start_time_ms);
            break_points.insert(note.end_time_ms);
        }
        let mut breakpoint_vec = break_points.iter().cloned().collect::<Vec<u32>>();
        breakpoint_vec.sort();
        if breakpoint_vec.is_empty() {
            self.processed_track.clear();
            return;
        }
        let mut prev_break_point = breakpoint_vec[0];
        for break_point in breakpoint_vec.iter().skip(1) {
            let to_push = (
                NoteWindow {
                    notes: track
                        .iter()
                        .filter(|sheet_note| {
                            sheet_note.start_time_ms <= prev_break_point
                                && sheet_note.end_time_ms >= *break_point
                        })
                        .map(|sheet_note| sheet_note.note.clone())
                        .collect(),
                },
                NoteTimeStamp {
                    start_time_ms: prev_break_point,
                    end_time_ms: *break_point,
                },
            );

            prev_break_point = *break_point;
            if !to_push.0.notes.is_empty() {
                windows.push(to_push);
            }
        }
        self.processed_track = windows
    }
    pub fn processed_track(&self) -> &[(NoteWindow, NoteTimeStamp)] {
        &self.processed_track
    }
    pub fn push_query_slice(&mut self, notes: NoteWindow) {
        if self.query.len() == QUERY_CAPACITY {
            self.query.pop_front();
            self.query_head = self.query_head.saturating_sub(1);
        }
        self.query.push_back(notes);
    }
    fn dtw(
        query: &VecDeque<NoteWindow>,
        reference: &[(NoteWindow, NoteTimeStamp)],
    ) -> Option<usize> {
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
                let c = crate::utils::dtw_cost(&query[i - 1].notes, &reference[j - 1].0.notes);
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
        if self.processed_track.is_empty() {
            return None;
        }
        let position = match self.last_position {
            None => {
                let calc_pos = Self::dtw(&self.query, &self.processed_track)?;
                self.query_head = self.query.len();
                calc_pos
            }
            Some(position) => {
                let tail: Vec<NoteWindow> =
                    self.query.iter().skip(self.query_head).cloned().collect();
                if tail.is_empty() {
                    return None;
                }
                let mut offset_index = 0;
                for tail_window in tail {
                    if position + offset_index >= self.processed_track.len() {
                        break;
                    }
                    if dtw_cost(
                        &tail_window.notes,
                        &self.processed_track[position + offset_index].0.notes,
                    ) != 0.0
                    {
                        self.frozen_count += 1;
                        self.last_position =
                            Some((position + offset_index + 1).min(self.processed_track.len() - 1));
                        if self.frozen_count > MAX_NOTE_FREEZES_BEFORE_READJUSTING {
                            self.last_position = None;
                        }
                        return None;
                    }
                    offset_index += 1;
                }
                self.query_head = self.query.len();
                if position + offset_index >= self.processed_track.len() {
                    return Some(self.processed_track[position].1.end_time_ms);
                }
                position + offset_index
            }
        };
        self.last_position = Some(position);
        Some(self.processed_track[position].1.start_time_ms)
    }
}
