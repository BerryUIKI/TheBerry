use chrono::Local;
use uuid::Uuid;

pub struct TemplateEngine;

impl TemplateEngine {
    pub fn expand(template: &str) -> String {
        Self::expand_with_clipboard_provider(template, || {
            arboard::Clipboard::new()
                .ok()
                .and_then(|mut c| c.get_text().ok())
                .unwrap_or_default()
        })
    }

    pub fn expand_with_clipboard_provider<F>(template: &str, get_clip: F) -> String
    where
        F: FnOnce() -> String,
    {
        let now = Local::now();
        let date_str = now.format("%Y-%m-%d").to_string();
        let time_str = now.format("%H:%M:%S").to_string();
        let datetime_str = now.format("%Y-%m-%d %H:%M:%S").to_string();
        let year_str = now.format("%Y").to_string();
        let month_str = now.format("%m").to_string();
        let day_str = now.format("%d").to_string();

        let mut clip_cached: Option<String> = None;
        let mut get_clip_fn = Some(get_clip);

        let mut result = String::with_capacity(template.len());
        let mut cursor = 0;

        while let Some(start_offset) = template[cursor..].find("${") {
            let start = cursor + start_offset;
            result.push_str(&template[cursor..start]);

            if let Some(end_offset) = template[start..].find('}') {
                let end = start + end_offset;
                let token = &template[start..=end];

                match token {
                    "${CURRENT_DATE}" | "${DATE}" => result.push_str(&date_str),
                    "${CURRENT_TIME}" | "${TIME}" => result.push_str(&time_str),
                    "${CURRENT_DATETIME}" | "${DATETIME}" => result.push_str(&datetime_str),
                    "${CURRENT_YEAR}" => result.push_str(&year_str),
                    "${CURRENT_MONTH}" => result.push_str(&month_str),
                    "${CURRENT_DAY}" => result.push_str(&day_str),
                    "${UUID}" => result.push_str(&Uuid::new_v4().to_string()),
                    "${CLIPBOARD_TEXT}" | "${CLIPBOARD}" => {
                        let text = clip_cached.get_or_insert_with(|| {
                            if let Some(f) = get_clip_fn.take() {
                                f()
                            } else {
                                String::new()
                            }
                        });
                        result.push_str(text);
                    }
                    _ => {
                        result.push_str(token);
                    }
                }
                cursor = end + 1;
            } else {
                result.push_str(&template[start..]);
                cursor = template.len();
                break;
            }
        }

        if cursor < template.len() {
            result.push_str(&template[cursor..]);
        }

        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_single_pass_expansion_prevents_nested_injection() {
        // Clipboard contains what looks like a template tag
        let template = "Prefix: ${CLIPBOARD_TEXT} | Date: ${DATE}";
        let clip_val = "Injected: ${DATE} and ${UUID}";

        let expanded = TemplateEngine::expand_with_clipboard_provider(template, || clip_val.to_string());

        assert!(expanded.starts_with("Prefix: Injected: ${DATE} and ${UUID} | Date: "));
        // The literal ${DATE} from clipboard content was not re-expanded
        assert!(expanded.contains("${DATE} and ${UUID}"));
    }

    #[test]
    fn test_uuid_and_date_expansion() {
        let template = "ID: ${UUID}, Year: ${CURRENT_YEAR}";
        let expanded = TemplateEngine::expand(template);

        assert!(!expanded.contains("${UUID}"));
        assert!(!expanded.contains("${CURRENT_YEAR}"));
        assert!(expanded.contains("ID: "));
        assert!(expanded.contains("Year: "));
    }
}
