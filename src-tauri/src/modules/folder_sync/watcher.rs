use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use parking_lot::Mutex;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::Instant;

pub struct WatcherManager {
    watchers: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

impl Default for WatcherManager {
    fn default() -> Self {
        Self::new()
    }
}

impl WatcherManager {
    pub fn new() -> Self {
        Self {
            watchers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn is_watching(&self, profile_id: &str) -> bool {
        self.watchers.lock().contains_key(profile_id)
    }

    pub fn stop_watcher(&self, profile_id: &str) {
        if let Some(stop_flag) = self.watchers.lock().remove(profile_id) {
            stop_flag.store(true, Ordering::Relaxed);
            tracing::info!("RealTimeSync stopped for profile {}", profile_id);
        }
    }

    pub fn stop_all(&self) {
        let mut map = self.watchers.lock();
        for (_, stop_flag) in map.drain() {
            stop_flag.store(true, Ordering::Relaxed);
        }
    }

    pub fn start_watcher<F>(
        &self,
        profile_id: String,
        watch_path: PathBuf,
        debounce_secs: u64,
        on_trigger: F,
    ) -> Result<(), String>
    where
        F: Fn(String) + Send + Sync + 'static,
    {
        // Stop any existing watcher for this profile
        self.stop_watcher(&profile_id);

        if !watch_path.exists() || !watch_path.is_dir() {
            return Err(format!("Watch path does not exist or is not a directory: {}", watch_path.display()));
        }

        let stop_flag = Arc::new(AtomicBool::new(false));
        self.watchers.lock().insert(profile_id.clone(), stop_flag.clone());

        let (tx, mut rx) = mpsc::unbounded_channel::<Event>();

        let mut watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    let _ = tx.send(event);
                }
            },
            Config::default(),
        )
        .map_err(|e| format!("Failed to create filesystem watcher: {}", e))?;

        watcher
            .watch(&watch_path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to start watch on {}: {}", watch_path.display(), e))?;

        let profile_id_clone = profile_id.clone();
        let debounce_dur = Duration::from_secs(debounce_secs.max(2));

        tokio::spawn(async move {
            // Keep watcher alive inside async task
            let _watcher_guard = watcher;
            let mut last_event_time: Option<Instant> = None;

            loop {
                if stop_flag.load(Ordering::Relaxed) {
                    break;
                }

                // Wait with a small timeout or for incoming notify events
                tokio::select! {
                    Some(_event) = rx.recv() => {
                        last_event_time = Some(Instant::now());
                    }
                    _ = tokio::time::sleep(Duration::from_millis(500)) => {
                        if let Some(t) = last_event_time {
                            if t.elapsed() >= debounce_dur {
                                last_event_time = None;
                                tracing::info!("RealTimeSync debounce elapsed for profile {}, triggering sync", profile_id_clone);
                                on_trigger(profile_id_clone.clone());
                            }
                        }
                    }
                }
            }
        });

        tracing::info!("RealTimeSync started for profile {} on {}", profile_id, watch_path.display());
        Ok(())
    }
}
