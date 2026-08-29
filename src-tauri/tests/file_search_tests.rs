use std::fs::File;
use std::io::Write;
use tempfile::tempdir;
use the_berry_lib::modules::file_search::indexer::{FileSearchEngine, SearchQuery};

#[test]
fn test_file_search_traversal_and_filters() {
    let temp = tempdir().expect("failed to create temp dir");
    let root = temp.path();

    // Create sample directory tree
    let code_dir = root.join("src");
    let doc_dir = root.join("docs");
    std::fs::create_dir_all(&code_dir).expect("create code dir");
    std::fs::create_dir_all(&doc_dir).expect("create doc dir");

    let file_rs = code_dir.join("main.rs");
    let file_md = doc_dir.join("guide.md");
    let file_txt = root.join("notes.txt");

    File::create(&file_rs)
        .and_then(|mut f| f.write_all(b"fn main() {}"))
        .expect("create file_rs");
    File::create(&file_md)
        .and_then(|mut f| f.write_all(b"# Guide"))
        .expect("create file_md");
    File::create(&file_txt)
        .and_then(|mut f| f.write_all(b"Meeting notes"))
        .expect("create file_txt");

    // Test search by substring
    let query_all = SearchQuery {
        pattern: "guide".to_string(),
        search_root: Some(root.to_string_lossy().to_string()),
        max_results: Some(50),
        file_type_filter: Some("all".to_string()),
        case_sensitive: Some(false),
    };
    let res = FileSearchEngine::search(query_all);
    assert_eq!(res.len(), 1);
    assert_eq!(res[0].name, "guide.md");

    // Test code filter
    let query_code = SearchQuery {
        pattern: "main".to_string(),
        search_root: Some(root.to_string_lossy().to_string()),
        max_results: Some(50),
        file_type_filter: Some("code".to_string()),
        case_sensitive: Some(false),
    };
    let res_code = FileSearchEngine::search(query_code);
    assert_eq!(res_code.len(), 1);
    assert_eq!(res_code[0].name, "main.rs");

    // Test drive scanner
    let drives = FileSearchEngine::get_available_drives();
    assert!(!drives.is_empty());

    // Test non-existent path handling
    let bad_path = root.join("missing_file.xyz").to_string_lossy().to_string();
    assert!(FileSearchEngine::reveal_in_explorer(&bad_path).is_err());
    assert!(FileSearchEngine::open_file_or_folder(&bad_path).is_err());
}
