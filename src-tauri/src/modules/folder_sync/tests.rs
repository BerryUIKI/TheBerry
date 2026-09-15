use super::comparator::Comparator;
use super::model::{
    CompareResult, CompareVariant, DeletionVariant, PathFilter, SyncAction, SyncVariant,
};
use super::scanner::Scanner;
use super::synchronizer::Synchronizer;
use std::fs::{self, File};
use std::io::Write;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tempfile::tempdir;

#[test]
fn test_wildcard_matching() {
    assert!(Scanner::is_match_wildcard("*.tmp", "test.tmp"));
    assert!(Scanner::is_match_wildcard("*.tmp", "TEST.TMP"));
    assert!(!Scanner::is_match_wildcard("*.tmp", "test.txt"));
    assert!(Scanner::is_match_wildcard("~*", "~$doc.docx"));
    assert!(Scanner::is_match_wildcard("photo_???.jpg", "photo_001.jpg"));
    assert!(!Scanner::is_match_wildcard("photo_???.jpg", "photo_1.jpg"));
}

#[test]
fn test_path_filter_patterns() {
    let filter = PathFilter::default();
    assert!(Scanner::is_excluded("file.tmp", 100, false, &filter));
    assert!(Scanner::is_excluded("docs/sub/temp.tmp", 100, false, &filter));
    assert!(Scanner::is_excluded("node_modules/pkg/index.js", 100, false, &filter));
    assert!(Scanner::is_excluded(".git/HEAD", 50, false, &filter));
    assert!(!Scanner::is_excluded("src/main.rs", 200, false, &filter));
}

#[test]
fn test_scanner_and_comparator() {
    let left_dir = tempdir().unwrap();
    let right_dir = tempdir().unwrap();

    // Left files: common.txt, only_left.txt, changed.txt
    let common_l = left_dir.path().join("common.txt");
    let mut f1 = File::create(&common_l).unwrap();
    f1.write_all(b"identical content").unwrap();

    let only_l = left_dir.path().join("only_left.txt");
    let mut f2 = File::create(&only_l).unwrap();
    f2.write_all(b"left only content").unwrap();

    let changed_l = left_dir.path().join("changed.txt");
    let mut f3 = File::create(&changed_l).unwrap();
    f3.write_all(b"left newer content updated").unwrap();

    // Right files: common.txt, only_right.txt, changed.txt
    let common_r = right_dir.path().join("common.txt");
    let mut f4 = File::create(&common_r).unwrap();
    f4.write_all(b"identical content").unwrap();

    let only_r = right_dir.path().join("only_right.txt");
    let mut f5 = File::create(&only_r).unwrap();
    f5.write_all(b"right only content").unwrap();

    let changed_r = right_dir.path().join("changed.txt");
    let mut f6 = File::create(&changed_r).unwrap();
    f6.write_all(b"old content").unwrap();

    let filter = PathFilter {
        include_patterns: vec!["*".to_string()],
        exclude_patterns: vec![],
        min_size_bytes: None,
        max_size_bytes: None,
    };

    let left_files = Scanner::scan_directory(left_dir.path(), &filter, false).unwrap();
    let right_files = Scanner::scan_directory(right_dir.path(), &filter, false).unwrap();

    assert_eq!(left_files.len(), 3);
    assert_eq!(right_files.len(), 3);

    // Test Mirror comparison
    let mirror_manifest = Comparator::compare(
        &left_files,
        &right_files,
        CompareVariant::TimeAndSize,
        SyncVariant::Mirror,
    );

    let only_left_item = mirror_manifest
        .items
        .iter()
        .find(|i| i.relative_path == "only_left.txt")
        .unwrap();
    assert_eq!(only_left_item.compare_result, CompareResult::LeftOnly);
    assert_eq!(only_left_item.action, SyncAction::CopyLeftToRight);

    let only_right_item = mirror_manifest
        .items
        .iter()
        .find(|i| i.relative_path == "only_right.txt")
        .unwrap();
    assert_eq!(only_right_item.compare_result, CompareResult::RightOnly);
    assert_eq!(only_right_item.action, SyncAction::DeleteRight);

    // Test Update comparison (should not delete only_right)
    let update_manifest = Comparator::compare(
        &left_files,
        &right_files,
        CompareVariant::TimeAndSize,
        SyncVariant::Update,
    );
    let only_right_update = update_manifest
        .items
        .iter()
        .find(|i| i.relative_path == "only_right.txt")
        .unwrap();
    assert_eq!(only_right_update.action, SyncAction::DoNothing);
}

#[test]
fn test_synchronizer_mirror_execution_with_versioning() {
    let left_dir = tempdir().unwrap();
    let right_dir = tempdir().unwrap();
    let version_dir = tempdir().unwrap();

    // Create Left files
    let left_file = left_dir.path().join("doc.txt");
    fs::write(&left_file, b"version 2 content from left").unwrap();

    // Create Right files
    let right_file = right_dir.path().join("doc.txt");
    fs::write(&right_file, b"version 1 old content on right").unwrap();

    let right_extra = right_dir.path().join("obsolete.txt");
    fs::write(&right_extra, b"extra file to be deleted").unwrap();

    let filter = PathFilter {
        include_patterns: vec!["*".to_string()],
        exclude_patterns: vec![],
        min_size_bytes: None,
        max_size_bytes: None,
    };

    let left_files = Scanner::scan_directory(left_dir.path(), &filter, false).unwrap();
    let right_files = Scanner::scan_directory(right_dir.path(), &filter, false).unwrap();

    let manifest = Comparator::compare(
        &left_files,
        &right_files,
        CompareVariant::TimeAndSize,
        SyncVariant::Mirror,
    );

    let cancel_flag = Arc::new(AtomicBool::new(false));
    let mut events = Vec::new();

    let result = Synchronizer::execute_sync(
        "job_123",
        left_dir.path(),
        right_dir.path(),
        &manifest.items,
        DeletionVariant::Versioning,
        Some(version_dir.path()),
        cancel_flag,
        |ev| events.push(ev),
    );

    assert!(result.success);
    assert_eq!(result.files_copied, 1);
    assert_eq!(result.files_deleted, 1);

    // Verify right file was updated to version 2
    let updated_right_content = fs::read_to_string(&right_file).unwrap();
    assert_eq!(updated_right_content, "version 2 content from left");

    // Verify obsolete file was removed from right
    assert!(!right_extra.exists());

    // Verify versioning directory preserved archived files
    let mut found_version_files = false;
    for e in walkdir::WalkDir::new(version_dir.path()).min_depth(1).into_iter().flatten() {
        if e.file_name() == "doc.txt" || e.file_name() == "obsolete.txt" {
            found_version_files = true;
            break;
        }
    }
    assert!(found_version_files, "Old files should be archived in versioning folder");
}
