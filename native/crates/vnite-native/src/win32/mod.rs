mod icon;
mod notification;
mod privilege;

use crate::{log, napi_win32::ProcessInfo};

pub fn get_all_process() -> Vec<ProcessInfo> {
  vnite_process_monitor::win32::get_all_process()
    .into_iter()
    .map(|process| ProcessInfo {
      pid: process.pid,
      full_path: process.full_path,
    })
    .collect()
}

pub use vnite_process_monitor::win32::get_process_full_path_by_pid;

pub fn extract_executable_icon(path: &str) -> Result<Vec<u8>, String> {
  icon::extract_executable_icon(path)
}

pub fn is_elevated_privilege() -> bool {
  let result = privilege::is_elevated_privilege();
  match result {
    Err(e) => {
      log::error(e.message().as_str());
      false
    }
    Ok(v) => v,
  }
}

pub fn send_notification(
  app_id: String,
  title: Option<String>,
  line1: Option<String>,
  line2: Option<String>,
  image: Option<String>,
  silent: Option<bool>,
) {
  let mut noti = notification::WinNotification::new(app_id);
  if let Some(content) = title {
    noti.title(content);
  }
  if let Some(content) = line1 {
    noti.line1(content);
  }
  if let Some(content) = line2 {
    noti.line2(content);
  }
  if let Some(content) = image {
    noti.image(content);
  }
  if let Some(content) = silent {
    noti.is_silent(content);
  }
  let result = noti.show();
  match result {
    Ok(_) => {
      log::info("A system notification has been sent.");
    }
    Err(err) => {
      log::error(format!("Failed to send system notification: {}", err.message()).as_str());
    }
  }
}
