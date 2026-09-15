use super::model::{
    CompareResult, CompareVariant, ComparisonItem, ComparisonManifest, ComparisonSummary, FileInfo,
    SyncAction, SyncVariant,
};
use std::collections::{BTreeSet, HashMap};

pub struct Comparator;

impl Comparator {
    pub const TIMESTAMP_TOLERANCE_SECS: u64 = 2;

    pub fn compare(
        left_files: &HashMap<String, FileInfo>,
        right_files: &HashMap<String, FileInfo>,
        compare_var: CompareVariant,
        sync_var: SyncVariant,
    ) -> ComparisonManifest {
        let mut all_paths = BTreeSet::new();
        for k in left_files.keys() {
            all_paths.insert(k.as_str());
        }
        for k in right_files.keys() {
            all_paths.insert(k.as_str());
        }

        let mut items = Vec::with_capacity(all_paths.len());
        let mut summary = ComparisonSummary::default();

        for rel_path in all_paths {
            let left_opt = left_files.get(rel_path).cloned();
            let right_opt = right_files.get(rel_path).cloned();

            let is_dir = left_opt
                .as_ref()
                .map(|f| f.is_dir)
                .or_else(|| right_opt.as_ref().map(|f| f.is_dir))
                .unwrap_or(false);

            let (cmp_result, suggested_action) = match (&left_opt, &right_opt) {
                (Some(_left), None) => {
                    summary.left_only_items += 1;
                    let act = match sync_var {
                        SyncVariant::TwoWay | SyncVariant::Mirror | SyncVariant::Update | SyncVariant::Custom => {
                            SyncAction::CopyLeftToRight
                        }
                    };
                    (CompareResult::LeftOnly, act)
                }
                (None, Some(_right)) => {
                    summary.right_only_items += 1;
                    let act = match sync_var {
                        SyncVariant::TwoWay => SyncAction::CopyRightToLeft,
                        SyncVariant::Mirror => SyncAction::DeleteRight,
                        SyncVariant::Update => SyncAction::DoNothing,
                        SyncVariant::Custom => SyncAction::DoNothing,
                    };
                    (CompareResult::RightOnly, act)
                }
                (Some(left), Some(right)) => {
                    if left.is_dir && right.is_dir {
                        summary.equal_items += 1;
                        (CompareResult::Equal, SyncAction::DoNothing)
                    } else if left.is_dir != right.is_dir {
                        summary.conflict_items += 1;
                        (CompareResult::Conflict, SyncAction::Conflict)
                    } else {
                        // Both are files
                        Self::compare_files(left, right, compare_var, sync_var, &mut summary)
                    }
                }
                (None, None) => (CompareResult::Equal, SyncAction::DoNothing),
            };

            // Calculate byte transfers & deletes based on suggested action
            match suggested_action {
                SyncAction::CopyLeftToRight => {
                    if let Some(left) = &left_opt {
                        if !left.is_dir {
                            summary.bytes_to_transfer_l2r += left.size_bytes;
                        }
                    }
                }
                SyncAction::CopyRightToLeft => {
                    if let Some(right) = &right_opt {
                        if !right.is_dir {
                            summary.bytes_to_transfer_r2l += right.size_bytes;
                        }
                    }
                }
                SyncAction::DeleteRight => {
                    summary.items_to_delete_right += 1;
                }
                SyncAction::DeleteLeft => {
                    summary.items_to_delete_left += 1;
                }
                SyncAction::DoNothing => {}
                SyncAction::Conflict => {}
            }

            items.push(ComparisonItem {
                id: uuid::Uuid::new_v4().to_string(),
                relative_path: rel_path.to_string(),
                is_dir,
                left: left_opt,
                right: right_opt,
                compare_result: cmp_result,
                suggested_action,
                action: suggested_action,
            });
        }

        summary.total_items = items.len();

        ComparisonManifest { items, summary }
    }

    fn compare_files(
        left: &FileInfo,
        right: &FileInfo,
        compare_var: CompareVariant,
        sync_var: SyncVariant,
        summary: &mut ComparisonSummary,
    ) -> (CompareResult, SyncAction) {
        match compare_var {
            CompareVariant::TimeAndSize => {
                let size_eq = left.size_bytes == right.size_bytes;
                let time_diff = left.modified_timestamp_secs.abs_diff(right.modified_timestamp_secs);

                if size_eq && time_diff <= Self::TIMESTAMP_TOLERANCE_SECS {
                    summary.equal_items += 1;
                    (CompareResult::Equal, SyncAction::DoNothing)
                } else if left.modified_timestamp_secs > right.modified_timestamp_secs + Self::TIMESTAMP_TOLERANCE_SECS {
                    summary.different_items += 1;
                    let act = match sync_var {
                        SyncVariant::TwoWay | SyncVariant::Mirror | SyncVariant::Update | SyncVariant::Custom => {
                            SyncAction::CopyLeftToRight
                        }
                    };
                    (CompareResult::LeftNewer, act)
                } else if right.modified_timestamp_secs > left.modified_timestamp_secs + Self::TIMESTAMP_TOLERANCE_SECS {
                    summary.different_items += 1;
                    let act = match sync_var {
                        SyncVariant::TwoWay => SyncAction::CopyRightToLeft,
                        SyncVariant::Mirror => SyncAction::CopyLeftToRight, // Mirror always overrides target with source
                        SyncVariant::Update => SyncAction::DoNothing,
                        SyncVariant::Custom => SyncAction::DoNothing,
                    };
                    (CompareResult::RightNewer, act)
                } else {
                    // Same time (within 2s) but different sizes
                    summary.different_items += 1;
                    let act = match sync_var {
                        SyncVariant::TwoWay => SyncAction::Conflict,
                        SyncVariant::Mirror => SyncAction::CopyLeftToRight,
                        SyncVariant::Update => SyncAction::CopyLeftToRight,
                        SyncVariant::Custom => SyncAction::Conflict,
                    };
                    (CompareResult::DifferentContent, act)
                }
            }
            CompareVariant::ContentHash => {
                let size_eq = left.size_bytes == right.size_bytes;
                let hash_eq = match (&left.hash, &right.hash) {
                    (Some(h1), Some(h2)) => h1 == h2,
                    _ => false,
                };

                if size_eq && hash_eq {
                    summary.equal_items += 1;
                    (CompareResult::Equal, SyncAction::DoNothing)
                } else {
                    summary.different_items += 1;
                    let act = match sync_var {
                        SyncVariant::TwoWay => SyncAction::Conflict,
                        SyncVariant::Mirror => SyncAction::CopyLeftToRight,
                        SyncVariant::Update => SyncAction::CopyLeftToRight,
                        SyncVariant::Custom => SyncAction::Conflict,
                    };
                    (CompareResult::DifferentContent, act)
                }
            }
            CompareVariant::SizeOnly => {
                if left.size_bytes == right.size_bytes {
                    summary.equal_items += 1;
                    (CompareResult::Equal, SyncAction::DoNothing)
                } else {
                    summary.different_items += 1;
                    let act = match sync_var {
                        SyncVariant::TwoWay => SyncAction::Conflict,
                        SyncVariant::Mirror => SyncAction::CopyLeftToRight,
                        SyncVariant::Update => SyncAction::CopyLeftToRight,
                        SyncVariant::Custom => SyncAction::Conflict,
                    };
                    (CompareResult::DifferentContent, act)
                }
            }
        }
    }
}
