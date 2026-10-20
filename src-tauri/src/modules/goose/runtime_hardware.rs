use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub(super) struct Hardware {
    pub cuda: bool,
    pub vulkan: bool,
    pub fingerprint: String,
}

impl Hardware {
    pub fn backends(&self) -> Vec<&'static str> {
        let mut result = Vec::new();
        if self.cuda {
            result.push("cuda");
        }
        if self.vulkan {
            result.push("vulkan");
        }
        result.push("cpu");
        result
    }
}

#[cfg(not(all(windows, target_arch = "x86_64")))]
pub(super) fn detect() -> Hardware {
    Hardware::default()
}

#[cfg(all(windows, target_arch = "x86_64"))]
pub(super) fn detect() -> Hardware {
    use sha2::{Digest, Sha256};
    let (cuda, cuda_identity) = cuda_devices();
    let (vulkan, vulkan_identity) = vulkan_devices();
    Hardware {
        cuda,
        vulkan,
        fingerprint: format!(
            "{:x}",
            Sha256::digest(format!("{cuda_identity}|{vulkan_identity}"))
        ),
    }
}

#[cfg(all(windows, target_arch = "x86_64"))]
fn cuda_devices() -> (bool, String) {
    // Load drivers from System32, never from the working directory or PATH.
    let system = std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into());
    let path = std::path::PathBuf::from(system).join("System32/nvcuda.dll");
    // All function pointers remain bounded by the lifetime of the driver library.
    unsafe {
        let Ok(library) = libloading::Library::new(path) else {
            return (false, "no-cuda-driver".into());
        };
        let probe = || -> Option<(bool, String)> {
            let init = library
                .get::<unsafe extern "system" fn(u32) -> i32>(b"cuInit\0")
                .ok()?;
            let version = library
                .get::<unsafe extern "system" fn(*mut i32) -> i32>(b"cuDriverGetVersion\0")
                .ok()?;
            let count = library
                .get::<unsafe extern "system" fn(*mut i32) -> i32>(b"cuDeviceGetCount\0")
                .ok()?;
            let name = library
                .get::<unsafe extern "system" fn(*mut i8, i32, i32) -> i32>(b"cuDeviceGetName\0")
                .ok()?;
            let mut driver = 0;
            let mut devices = 0;
            let version_result = version(&mut driver);
            let initialized = init(0);
            if initialized != 0 || version_result != 0 || count(&mut devices) != 0 {
                return Some((false, format!("cuda:{driver}:{initialized}")));
            }
            let mut identity = format!("cuda:{driver}:{devices}");
            for device in 0..devices {
                let mut buffer = [0i8; 256];
                if name(buffer.as_mut_ptr(), buffer.len() as i32, device) == 0 {
                    identity.push_str(&std::ffi::CStr::from_ptr(buffer.as_ptr()).to_string_lossy());
                }
            }
            Some((driver >= 12040 && devices > 0, identity))
        };
        probe().unwrap_or((false, "cuda-probe-failed".into()))
    }
}

#[cfg(all(windows, target_arch = "x86_64"))]
fn vulkan_devices() -> (bool, String) {
    use ash::vk;
    let system = std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into());
    let path = std::path::PathBuf::from(system).join("System32/vulkan-1.dll");
    // No window, surface, device, or queue is created during capability detection.
    unsafe {
        let Ok(entry) = ash::Entry::load_from(path) else {
            return (false, "no-vulkan-driver".into());
        };
        let app = vk::ApplicationInfo::default().api_version(vk::API_VERSION_1_2);
        let info = vk::InstanceCreateInfo::default().application_info(&app);
        let Ok(instance) = entry.create_instance(&info, None) else {
            return (false, "vulkan-instance-failed".into());
        };
        let mut identity = String::from("vulkan:");
        let mut supported = false;
        if let Ok(devices) = instance.enumerate_physical_devices() {
            for device in devices {
                let p = instance.get_physical_device_properties(device);
                identity.push_str(&format!(
                    "{}:{}:{}:{}:{:?};",
                    p.vendor_id,
                    p.device_id,
                    p.api_version,
                    p.driver_version,
                    p.pipeline_cache_uuid
                ));
                let physical = matches!(
                    p.device_type,
                    vk::PhysicalDeviceType::DISCRETE_GPU
                        | vk::PhysicalDeviceType::INTEGRATED_GPU
                        | vk::PhysicalDeviceType::VIRTUAL_GPU
                );
                let compute = instance
                    .get_physical_device_queue_family_properties(device)
                    .iter()
                    .any(|q| q.queue_count > 0 && q.queue_flags.contains(vk::QueueFlags::COMPUTE));
                supported |= physical && compute && p.api_version >= vk::API_VERSION_1_2;
            }
        }
        instance.destroy_instance(None);
        (supported, identity)
    }
}
