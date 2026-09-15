use chrono::Utc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CompareVariant {
    TimeAndSize,
    ContentHash,
    SizeOnly,
}

impl Default for CompareVariant {
    fn default() -> Self {
        Self::TimeAndSize
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncVariant {
    TwoWay,
    Mirror,
    Update,
    Custom,
}

impl Default for SyncVariant {
    fn default() -> Self {
        Self::TwoWay
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CompareResult {
    Equal,
    LeftOnly,
    RightOnly,
    LeftNewer,
    RightNewer,
    DifferentContent,
    Conflict,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SyncAction {
    CopyLeftToRight,
    CopyRightToLeft,
    DeleteLeft,
    DeleteRight,
    DoNothing,
    Conflict,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeletionVariant {
    RecycleBin,
    Versioning,
    Permanent,
}

impl Default for DeletionVariant {
    fn default() -> Self {
        Self::RecycleBin
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PathFilter {
    pub include_patterns: Vec<String>,
    pub exclude_patterns: Vec<String>,
    pub min_size_bytes: Option<u64>,
    pub max_size_bytes: Option<u64>,
}

impl Default for PathFilter {
    fn default() -> Self {
        Self {
            include_patterns: vec!["*".to_string()],
            exclude_patterns: vec![
                "*.tmp".to_string(),
                "~$*".to_string(),
                ".git/*".to_string(),
                "node_modules/*".to_string(),
                ".DS_Store".to_string(),
                "Thumbs.db".to_string(),
                "desktop.ini".to_string(),
            ],
            min_size_bytes: None,
            max_size_bytes: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub relative_path: String,
    pub size_bytes: u64,
    pub modified_timestamp_secs: u64,
    pub is_dir: bool,
    pub hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparisonItem {
    pub id: String,
    pub relative_path: String,
    pub is_dir: bool,
    pub left: Option<FileInfo>,
    pub right: Option<FileInfo>,
    pub compare_result: CompareResult,
    pub suggested_action: SyncAction,
    pub action: SyncAction,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ComparisonSummary {
    pub total_items: usize,
    pub equal_items: usize,
    pub left_only_items: usize,
    pub right_only_items: usize,
    pub different_items: usize,
    pub conflict_items: usize,
    pub bytes_to_transfer_l2r: u64,
    pub bytes_to_transfer_r2l: u64,
    pub items_to_delete_right: usize,
    pub items_to_delete_left: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparisonManifest {
    pub items: Vec<ComparisonItem>,
    pub summary: ComparisonSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncProfile {
    pub id: String,
    pub name: String,
    pub left_path: String,
    pub right_path: String,
    pub sync_variant: SyncVariant,
    pub compare_variant: CompareVariant,
    pub deletion_variant: DeletionVariant,
    pub versioning_dir: Option<String>,
    pub filter: PathFilter,
    pub realtime_enabled: bool,
    pub realtime_debounce_secs: u64,
    pub last_sync_timestamp: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

impl SyncProfile {
    pub fn new(name: String, left_path: String, right_path: String) -> Self {
        let now = Utc::now().timestamp();
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            left_path,
            right_path,
            sync_variant: SyncVariant::TwoWay,
            compare_variant: CompareVariant::TimeAndSize,
            deletion_variant: DeletionVariant::RecycleBin,
            versioning_dir: None,
            filter: PathFilter::default(),
            realtime_enabled: false,
            realtime_debounce_secs: 10,
            last_sync_timestamp: None,
            created_at: now,
            updated_at: now,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncProgressEvent {
    pub job_id: String,
    pub current_file: String,
    pub items_processed: usize,
    pub total_items: usize,
    pub bytes_processed: u64,
    pub total_bytes: u64,
    pub speed_bytes_per_sec: u64,
    pub stage: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncLogEntry {
    pub timestamp: i64,
    pub level: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub job_id: String,
    pub success: bool,
    pub files_copied: usize,
    pub files_deleted: usize,
    pub bytes_transferred: u64,
    pub duration_ms: u64,
    pub errors: Vec<String>,
    pub logs: Vec<SyncLogEntry>,
}
