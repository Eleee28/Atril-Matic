//! Tests for how `NoteTrack::add_track` cuts a score into `NoteWindow`s.
//! Run with: cargo test --test track_windows

mod common;

use audio_processor::note_track::NoteTrack;
use audio_processor::utils::{Note, NoteValue, SheetNote};
use audio_processor::config::AudioConfig;
use common::note;

type Signature = (Vec<(NoteValue, i32)>, u32, u32);

fn sheet(note: Note, start_time_ms: u32, end_time_ms: u32) -> SheetNote {
    SheetNote {
        note,
        start_time_ms,
        end_time_ms,
    }
}

/// `(pitch, start, end)` with the pitches sorted, so assertions do not depend
/// on the order `add_track` happens to emit the notes of a window in.
/// `dtw_cost` compares windows as unordered sets, so that order is not
/// meaningful.
fn sig(pitches: &[(NoteValue, i32)], start_time_ms: u32, end_time_ms: u32) -> Signature {
    let mut sorted = pitches.to_vec();
    // `NoteValue` derives PartialEq but not Ord, so order by its discriminant.
    sorted.sort_by_key(|&(value, octave)| (octave, value as i32));
    (sorted, start_time_ms, end_time_ms)
}

fn windows(track: &NoteTrack) -> Vec<Signature> {
    track
        .processed_track()
        .iter()
        .map(|(window, time)| {
            sig(
                &window
                    .notes
                    .iter()
                    .map(|n| (n.note_value.unwrap(), n.octave))
                    .collect::<Vec<_>>(),
                time.start_time_ms,
                time.end_time_ms,
            )
        })
        .collect()
}

fn build(track: &[SheetNote]) -> NoteTrack {
	let config = AudioConfig::default();

    let mut note_track = NoteTrack::new(config);
    note_track.add_track(track);
    note_track
}

/// A and C never overlap, but B and C share part of their duration. The cut
/// points are therefore 1000 (B starts), 1500 (C starts) and 2000 (B ends),
/// which yields [A] [B] [B,C] [C].
#[test]
fn partial_overlap_splits_into_maximal_constant_note_runs() {
    let a = note(NoteValue::A, 4);
    let b = note(NoteValue::B, 4);
    let c = note(NoteValue::C, 5);

    let track = build(&[
        sheet(a, 0, 1000),
        sheet(b, 1000, 2000),
        sheet(c, 1500, 2500),
    ]);

    assert_eq!(
        windows(&track),
        vec![
            sig(&[(NoteValue::A, 4)], 0, 1000),
            sig(&[(NoteValue::B, 4)], 1000, 1500),
            sig(&[(NoteValue::B, 4), (NoteValue::C, 5)], 1500, 2000),
            sig(&[(NoteValue::C, 5)], 2000, 2500),
        ],
        "the two overlapping notes need their own shared window"
    );
}

/// A note that is fully inside a longer one still forms its own window in the
/// middle: the sounding set genuinely changes there.
#[test]
fn a_fully_contained_note_still_gets_its_own_window() {
    let a = note(NoteValue::A, 4);
    let b = note(NoteValue::B, 4);

    let track = build(&[sheet(a, 0, 3000), sheet(b, 1000, 2000)]);

    assert_eq!(
        windows(&track),
        vec![
            sig(&[(NoteValue::A, 4)], 0, 1000),
            sig(&[(NoteValue::A, 4), (NoteValue::B, 4)], 1000, 2000),
            sig(&[(NoteValue::A, 4)], 2000, 3000),
        ],
        "containment is still a change of the sounding set"
    );
}

#[test]
fn notes_played_together_share_one_window() {
    let a = note(NoteValue::A, 4);
    let c = note(NoteValue::C, 5);
    let e = note(NoteValue::E, 5);

    let track = build(&[sheet(a, 0, 1000), sheet(c, 0, 1000), sheet(e, 0, 1000)]);

    assert_eq!(
        windows(&track),
        vec![sig(
            &[(NoteValue::A, 4), (NoteValue::C, 5), (NoteValue::E, 5)],
            0,
            1000
        )],
        "notes with identical boundaries are one chord, not three windows"
    );
}

#[test]
fn back_to_back_notes_produce_no_empty_window_between_them() {
    // The breakpoint at 1000 must not yield a zero-length window, and must not
    // yield an empty one either: [0,1000) and [1000,2000) are two notes.
    let a = note(NoteValue::A, 4);
    let b = note(NoteValue::B, 4);

    let track = build(&[sheet(a, 0, 1000), sheet(b, 1000, 2000)]);

    assert_eq!(
        windows(&track),
        vec![
            sig(&[(NoteValue::A, 4)], 0, 1000),
            sig(&[(NoteValue::B, 4)], 1000, 2000),
        ]
    );
}

/// The frontend drops rests when it builds the track, so the reference always
/// has gaps. A gap has no window: silence is simply a stretch of time where
/// nothing matches.
#[test]
fn rests_do_not_produce_windows() {
    let a = note(NoteValue::A, 4);
    let b = note(NoteValue::B, 4);

    let track = build(&[sheet(a, 0, 1000), sheet(b, 2000, 3000)]);

    assert_eq!(
        windows(&track),
        vec![
            sig(&[(NoteValue::A, 4)], 0, 1000),
            sig(&[(NoteValue::B, 4)], 2000, 3000),
        ],
        "the 1000-2000 gap must not become an empty window"
    );
}

/// `add_track` carries the comment "i assume the track is ordered by start
/// time", so feed it out of order and require the same result.
#[test]
fn the_order_of_the_input_track_does_not_matter() {
    let a = note(NoteValue::A, 4);
    let b = note(NoteValue::B, 4);
    let c = note(NoteValue::C, 5);

    let sorted = build(&[
        sheet(a, 0, 1000),
        sheet(b, 1000, 2000),
        sheet(c, 1500, 2500),
    ]);
    let reversed = build(&[
        sheet(c, 1500, 2500),
        sheet(b, 1000, 2000),
        sheet(a, 0, 1000),
    ]);

    assert_eq!(
        windows(&sorted),
        windows(&reversed),
        "windowing must not depend on the caller sorting the track"
    );
}

#[test]
fn an_empty_track_yields_no_windows() {
    let track = build(&[]);
    assert!(
        track.processed_track().is_empty(),
        "an empty track must not panic and must produce no windows"
    );
}

#[test]
fn adding_a_second_track_replaces_the_previous_one() {
    let a = note(NoteValue::A, 4);
    let b = note(NoteValue::B, 4);

    let mut track = build(&[sheet(a, 0, 1000)]);
    track.add_track(&[sheet(b, 1000, 2000)]);

    assert_eq!(
        windows(&track),
        vec![sig(&[(NoteValue::B, 4)], 1000, 2000)],
        "the second load must replace the first, not append to it"
    );
}
