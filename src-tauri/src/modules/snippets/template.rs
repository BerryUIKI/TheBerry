use chrono::Local;
use uuid::Uuid;

pub struct TemplateEngine;

impl TemplateEngine {
    pub fn expand(template: &str) -> String {
        let now = Local::now();
        let date_str = now.format("%Y-%m-%d").to_string();
        let time_str = now.format("%H:%M:%S").to_string();
        let datetime_str = now.format("%Y-%m-%d %H:%M:%S").to_string();
        let year_str = now.format("%Y").to_string();
        let month_str = now.format("%m").to_string();
        let day_str = now.format("%d").to_string();

        let mut expanded = template
            .replace("${CURRENT_DATE}", &date_str)
            .replace("${DATE}", &date_str)
            .replace("${CURRENT_TIME}", &time_str)
            .replace("${TIME}", &time_str)
            .replace("${CURRENT_DATETIME}", &datetime_str)
            .replace("${DATETIME}", &datetime_str)
            .replace("${CURRENT_YEAR}", &year_str)
            .replace("${CURRENT_MONTH}", &month_str)
            .replace("${CURRENT_DAY}", &day_str);

        // Replace ${UUID} dynamically each time it occurs
        while let Some(pos) = expanded.find("${UUID}") {
            let id = Uuid::new_v4().to_string();
            expanded.replace_range(pos..pos + 7, &id);
        }

        // Replace ${CLIPBOARD_TEXT} with current OS clipboard content
        if expanded.contains("${CLIPBOARD_TEXT}") || expanded.contains("${CLIPBOARD}") {
            let clip_text = arboard::Clipboard::new()
                .ok()
                .and_then(|mut c| c.get_text().ok())
                .unwrap_or_default();
            expanded = expanded
                .replace("${CLIPBOARD_TEXT}", &clip_text)
                .replace("${CLIPBOARD}", &clip_text);
        }

        expanded
    }
}
