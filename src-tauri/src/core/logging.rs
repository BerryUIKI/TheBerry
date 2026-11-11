use std::io::Write;
use std::path::PathBuf;

use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::fmt::MakeWriter;
use tracing_subscriber::EnvFilter;

/// Directory that receives rotated log files for the given data directory.
pub fn logs_dir(data_dir: &std::path::Path) -> PathBuf {
    data_dir.join("logs")
}

/// Initializes file logging under `<data_dir>/logs`, falling back to stderr before the
/// data directory exists. Installs a panic hook so crashes reach the same sink.
pub fn init(data_dir: Option<PathBuf>) {
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    let writer = data_dir
        .and_then(|dir| {
            let logs_dir = logs_dir(&dir);
            std::fs::create_dir_all(&logs_dir).ok()?;
            RollingFileAppender::builder()
                .rotation(Rotation::DAILY)
                .filename_prefix("theberry")
                .filename_suffix("log")
                .max_log_files(7)
                .build(&logs_dir)
                .ok()
        })
        .map(LogWriter::File)
        .unwrap_or(LogWriter::Stderr);

    let subscriber = tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_writer(writer)
        .with_ansi(false)
        .finish();

    if tracing::subscriber::set_global_default(subscriber).is_ok() {
        std::panic::set_hook(Box::new(|info| {
            let location = info
                .location()
                .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
                .unwrap_or_else(|| "unknown location".to_string());
            let payload = info
                .payload()
                .downcast_ref::<&str>()
                .copied()
                .or_else(|| info.payload().downcast_ref::<String>().map(String::as_str))
                .unwrap_or("unknown panic payload");
            tracing::error!("panic at {location}: {payload}");
            eprintln!("TheBerry panic at {location}: {payload}");
        }));
    }
}

enum LogWriter {
    File(RollingFileAppender),
    Stderr,
}

impl<'a> MakeWriter<'a> for LogWriter {
    type Writer = Box<dyn Write + 'a>;

    fn make_writer(&'a self) -> Self::Writer {
        match self {
            Self::File(appender) => Box::new(appender.make_writer()),
            Self::Stderr => Box::new(std::io::stderr()),
        }
    }
}
