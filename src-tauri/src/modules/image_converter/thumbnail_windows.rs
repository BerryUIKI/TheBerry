use image::RgbaImage;
use std::{mem::size_of, os::windows::ffi::OsStrExt, path::Path};
use windows::{
    core::PCWSTR,
    Win32::{
        Foundation::SIZE,
        Graphics::Gdi::{
            CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO,
            BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HBITMAP, HDC, HGDIOBJ,
        },
        System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED},
        UI::Shell::{
            IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_ICONONLY,
            SIIGBF_INCACHEONLY, SIIGBF_THUMBNAILONLY,
        },
    },
};

struct ComApartment;
impl Drop for ComApartment {
    fn drop(&mut self) {
        unsafe { CoUninitialize() };
    }
}
struct Bitmap(HBITMAP);
impl Drop for Bitmap {
    fn drop(&mut self) {
        unsafe {
            let _ = DeleteObject(HGDIOBJ(self.0 .0));
        }
    }
}
struct DeviceContext(HDC);
impl Drop for DeviceContext {
    fn drop(&mut self) {
        unsafe {
            let _ = DeleteDC(self.0);
        }
    }
}

/// Must run on a blocking worker: Shell providers may access disk or extract a preview.
pub(super) fn file_image(path: &Path, icon_only: bool) -> Result<RgbaImage, String> {
    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED)
            .ok()
            .map_err(|e| e.to_string())?;
        let _apartment = ComApartment;
        let absolute_path = std::path::absolute(path).map_err(|e| e.to_string())?;
        let wide_path: Vec<u16> = absolute_path
            .as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect();
        let factory: IShellItemImageFactory =
            SHCreateItemFromParsingName(PCWSTR(wide_path.as_ptr()), None)
                .map_err(|e| e.to_string())?;
        let size = SIZE {
            cx: super::THUMBNAIL_SIZE as i32,
            cy: super::THUMBNAIL_SIZE as i32,
        };
        let bitmap = if icon_only {
            factory.GetImage(size, SIIGBF_ICONONLY)
        } else {
            // Prefer the shared Shell cache; extract only when no thumbnail is cached.
            factory
                .GetImage(size, SIIGBF_INCACHEONLY | SIIGBF_THUMBNAILONLY)
                .or_else(|_| factory.GetImage(size, SIIGBF_THUMBNAILONLY))
        }
        .map_err(|e| e.to_string())?;
        let bitmap = Bitmap(bitmap);
        let mut description = BITMAP::default();
        if GetObjectW(
            HGDIOBJ(bitmap.0 .0),
            size_of::<BITMAP>() as i32,
            Some((&mut description as *mut BITMAP).cast()),
        ) == 0
        {
            return Err("Cannot read Shell bitmap dimensions".into());
        }
        let (width, height) = (description.bmWidth, description.bmHeight);
        if width <= 0 || height <= 0 || width > size.cx || height > size.cy {
            return Err("Shell returned invalid thumbnail dimensions".into());
        }
        let dc = DeviceContext(CreateCompatibleDC(None));
        if dc.0 .0.is_null() {
            return Err("Cannot create thumbnail device context".into());
        }
        let mut info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height, // Top-down BGRA rows.
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };
        let mut pixels = vec![0u8; width as usize * height as usize * 4];
        if GetDIBits(
            dc.0,
            bitmap.0,
            0,
            height as u32,
            Some(pixels.as_mut_ptr().cast()),
            &mut info,
            DIB_RGB_COLORS,
        ) != height
        {
            return Err("Cannot read Shell thumbnail pixels".into());
        }
        let opaque = pixels.as_chunks::<4>().0.iter().all(|pixel| pixel[3] == 0);
        for pixel in pixels.as_chunks_mut::<4>().0 {
            pixel.swap(0, 2);
            if opaque {
                pixel[3] = 255;
            } else if pixel[3] > 0 && pixel[3] < 255 {
                // Shell bitmaps use premultiplied alpha; PNG expects straight alpha.
                let alpha = pixel[3] as u32;
                for channel in &mut pixel[..3] {
                    *channel = ((*channel as u32 * 255 + alpha / 2) / alpha).min(255) as u8;
                }
            }
        }
        RgbaImage::from_raw(width as u32, height as u32, pixels)
            .ok_or_else(|| "Cannot construct Shell thumbnail image".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};
    use tempfile::tempdir;

    #[test]
    fn windows_shell_supplies_real_thumbnails_and_file_icons() {
        let temp = tempdir().unwrap();
        let photo = temp.path().join("Shell \u{56fe}\u{7247}.png");
        ImageBuffer::from_pixel(256, 128, Rgba([230u8, 30, 50, 255]))
            .save(&photo)
            .unwrap();
        let thumbnail = file_image(&photo, false).expect("Windows PNG thumbnail provider");
        assert_eq!(thumbnail.width(), thumbnail.height() * 2);
        let center = thumbnail
            .get_pixel(thumbnail.width() / 2, thumbnail.height() / 2)
            .0;
        assert!(center[0] > 200 && center[1] < 60 && center[3] == 255);
        let unknown = temp.path().join("unsupported.qoi");
        std::fs::write(&unknown, b"not a decodable image").unwrap();
        let icon = file_image(&unknown, true).expect("Windows file icon fallback");
        assert!(icon.width() > 0 && icon.width() <= super::super::THUMBNAIL_SIZE);
        assert!(icon.pixels().any(|pixel| pixel[3] > 0));
    }
}
