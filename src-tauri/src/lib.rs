use std::collections::HashMap;
use std::time::Instant;

use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};
use base64::Engine;

#[derive(Debug, Deserialize)]
pub struct HttpRequest {
    pub method: String,
    pub url: String,
    pub headers: HashMap<String, String>,
    pub body: Option<String>,
    pub body_type: Option<String>,
    pub timeout_ms: Option<u64>,
    pub follow_redirects: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct HttpResponse {
    pub status: u16,
    pub status_text: String,
    pub headers: HashMap<String, String>,
    pub body: String,
    pub body_bytes: Option<Vec<u8>>,
    pub duration_ms: u64,
    pub size_bytes: usize,
    pub is_binary: bool,
}

#[derive(Debug, Serialize)]
pub struct RequestError {
    pub message: String,
    pub kind: String,
}

#[tauri::command]
async fn send_request(request: HttpRequest) -> Result<HttpResponse, RequestError> {
    let timeout = request.timeout_ms.unwrap_or(30000);
    let follow_redirects = request.follow_redirects.unwrap_or(true);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(timeout))
        .redirect(if follow_redirects {
            reqwest::redirect::Policy::limited(10)
        } else {
            reqwest::redirect::Policy::none()
        })
        .danger_accept_invalid_certs(false)
        .build()
        .map_err(|e| RequestError {
            message: e.to_string(),
            kind: "build".to_string(),
        })?;

    let method = reqwest::Method::from_bytes(request.method.to_uppercase().as_bytes())
        .map_err(|e| RequestError {
            message: e.to_string(),
            kind: "method".to_string(),
        })?;

    let mut req_builder = client.request(method, &request.url);

    // Set headers
    let mut header_map = HeaderMap::new();
    for (key, value) in &request.headers {
        if let (Ok(name), Ok(val)) = (
            HeaderName::from_bytes(key.as_bytes()),
            HeaderValue::from_str(value),
        ) {
            header_map.insert(name, val);
        }
    }
    req_builder = req_builder.headers(header_map);

    // Set body
    if let Some(body) = request.body {
        if !body.is_empty() {
            let body_type = request.body_type.as_deref().unwrap_or("raw");
            match body_type {
                "json" => {
                    req_builder = req_builder.body(body);
                }
                "form-urlencoded" => {
                    req_builder = req_builder.body(body);
                }
                _ => {
                    req_builder = req_builder.body(body);
                }
            }
        }
    }

    let start = Instant::now();
    let response = req_builder.send().await.map_err(|e| {
        let kind = if e.is_timeout() {
            "timeout"
        } else if e.is_connect() {
            "connect"
        } else if e.is_request() {
            "request"
        } else {
            "unknown"
        };
        RequestError {
            message: e.to_string(),
            kind: kind.to_string(),
        }
    })?;
    let duration_ms = start.elapsed().as_millis() as u64;

    let status = response.status();
    let status_code = status.as_u16();
    let status_text = status.canonical_reason().unwrap_or("Unknown").to_string();

    // Collect response headers
    let mut resp_headers = HashMap::new();
    for (name, value) in response.headers() {
        resp_headers.insert(
            name.to_string(),
            value.to_str().unwrap_or("").to_string(),
        );
    }

    // Detect if binary based on content-type
    let content_type = resp_headers
        .get("content-type")
        .cloned()
        .unwrap_or_default();
    let is_binary = is_binary_content_type(&content_type);

    // Read body bytes
    let body_bytes = response.bytes().await.map_err(|e| RequestError {
        message: e.to_string(),
        kind: "read".to_string(),
    })?;

    let size_bytes = body_bytes.len();

    let (body_str, bytes_opt) = if is_binary {
        let b64 = base64::engine::general_purpose::STANDARD.encode(&body_bytes);
        (b64, Some(body_bytes.to_vec()))
    } else {
        let text = String::from_utf8_lossy(&body_bytes).to_string();
        (text, None)
    };

    Ok(HttpResponse {
        status: status_code,
        status_text,
        headers: resp_headers,
        body: body_str,
        body_bytes: bytes_opt,
        duration_ms,
        size_bytes,
        is_binary,
    })
}

fn is_binary_content_type(ct: &str) -> bool {
    let ct = ct.to_lowercase();
    if ct.contains("text/") || ct.contains("application/json") || ct.contains("application/xml")
        || ct.contains("application/javascript") || ct.contains("application/x-www-form-urlencoded")
    {
        return false;
    }
    ct.contains("image/") || ct.contains("audio/") || ct.contains("video/")
        || ct.contains("application/octet-stream") || ct.contains("application/pdf")
        || ct.contains("application/zip")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![send_request])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
