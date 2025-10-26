use std::collections::VecDeque;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::ipc::error::IpcError;
use log::{error, warn};
use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::State;

const GOOGLE_AUTOCOMPLETE_URL: &str = "https://places.googleapis.com/v1/places:autocomplete";
const GOOGLE_PLACE_DETAILS_URL: &str = "https://places.googleapis.com/v1";
const FIELD_MASK_AUTOCOMPLETE: &str = "suggestions.placePrediction.placeId,suggestions.placePrediction.place,\
suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text,\
suggestions.placePrediction.types,suggestions.placePrediction.distanceMeters";
const FIELD_MASK_DETAILS: &str = "id,name,formattedAddress,shortFormattedAddress,displayName,types,addressComponents,\
location,internationalPhoneNumber,nationalPhoneNumber";
const USER_AGENT: &str = "weg-translator/1.0 (google-places)";

const SOFT_WINDOW_MAX_REQUESTS: usize = 8;
const SOFT_WINDOW_DURATION: Duration = Duration::from_secs(1);
const BURST_WINDOW_MAX_REQUESTS: usize = 120;
const BURST_WINDOW_DURATION: Duration = Duration::from_secs(60);

pub struct GooglePlacesService {
    client: Client,
    api_key: Option<String>,
    rate_limiter: Mutex<RateLimiter>,
}

impl GooglePlacesService {
    pub fn new() -> Self {
        let api_key = std::env::var("GOOGLE_MAPS_API_KEY")
            .ok()
            .map(|key| key.trim().to_string())
            .filter(|key| !key.is_empty());

        if api_key.is_none() {
            error!(
                "GOOGLE_MAPS_API_KEY is not set. Address autocomplete will be disabled until the key is configured. \
                 Add GOOGLE_MAPS_API_KEY to the app environment (tauri.conf.json > env or OS env var) \
                 and restrict it to the Places API in Google Cloud."
            );
        }

        let client = Client::builder()
            .user_agent(USER_AGENT)
            .gzip(true)
            .brotli(true)
            .timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_else(|err| {
                error!("Failed to construct HTTP client for Google Places: {err}");
                Client::new()
            });

        Self {
            client,
            api_key,
            rate_limiter: Mutex::new(RateLimiter::new()),
        }
    }

    fn api_key(&self) -> Result<&str, IpcError> {
        self.api_key.as_deref().ok_or_else(|| {
            IpcError::Internal(
                "Address suggestions are not configured. Contact your administrator to set GOOGLE_MAPS_API_KEY."
                    .into(),
            )
        })
    }

    fn enforce_rate_limit(&self, scope: &str) -> Result<(), IpcError> {
        let mut limiter = self
            .rate_limiter
            .lock()
            .expect("GooglePlacesService rate limiter poisoned");

        match limiter.try_acquire(Instant::now()) {
            Ok(_) => Ok(()),
            Err(info) => {
                warn!(
                    "Throttling Google Places {scope} request ({})",
                    info.log_reason
                );
                Err(IpcError::Validation(info.user_message.into()))
            }
        }
    }

    async fn request_autocomplete(
        &self,
        api_key: &str,
        payload: &PlacesAutocompletePayload,
    ) -> Result<Value, IpcError> {
        let body = GoogleAutocompleteRequest::from_payload(payload);

        let response = self
            .client
            .post(GOOGLE_AUTOCOMPLETE_URL)
            .header("X-Goog-Api-Key", api_key)
            .header("X-Goog-FieldMask", FIELD_MASK_AUTOCOMPLETE)
            .json(&body)
            .send()
            .await
            .map_err(|err| map_transport_error("autocomplete request", err))?;

        let status = response.status();
        let text = response
            .text()
            .await
            .map_err(|err| map_transport_error("autocomplete response body", err))?;

        if !status.is_success() {
            return Err(handle_google_error("autocomplete", status, &text));
        }

        serde_json::from_str(&text).map_err(|err| {
            error!("Failed to parse Google Places autocomplete response: {err}; body={text}");
            IpcError::Internal("Received an unexpected response from Google Places.".into())
        })
    }

    async fn request_place_details(
        &self,
        api_key: &str,
        payload: &PlaceDetailsPayload,
    ) -> Result<Value, IpcError> {
        let resource = payload
            .resource_name
            .as_ref()
            .or(payload.place_id.as_ref())
            .ok_or_else(|| {
                IpcError::Validation("Select a suggestion before requesting details.".into())
            })?;

        let normalized = if resource.starts_with("places/") {
            resource.to_string()
        } else {
            format!("places/{resource}")
        };

        let mut request = self
            .client
            .get(format!("{GOOGLE_PLACE_DETAILS_URL}/{normalized}"))
            .header("X-Goog-Api-Key", api_key)
            .header("X-Goog-FieldMask", FIELD_MASK_DETAILS);

        if let Some(token) = payload.session_token.as_deref() {
            request = request.query(&[("sessionToken", token)]);
        }

        let response = request
            .send()
            .await
            .map_err(|err| map_transport_error("place-details request", err))?;
        let status = response.status();
        let text = response
            .text()
            .await
            .map_err(|err| map_transport_error("place-details response body", err))?;

        if !status.is_success() {
            return Err(handle_google_error("place-details", status, &text));
        }

        serde_json::from_str(&text).map_err(|err| {
            error!("Failed to parse Google Places details response: {err}; body={text}");
            IpcError::Internal("Received an unexpected response from Google Places.".into())
        })
    }

    pub async fn autocomplete(
        &self,
        payload: PlacesAutocompletePayload,
    ) -> Result<PlacesAutocompleteResponse, IpcError> {
        let trimmed = payload.query.trim();
        if trimmed.len() < 2 {
            return Err(IpcError::Validation(
                "Enter at least two characters to search for an address.".into(),
            ));
        }

        let api_key = self.api_key()?;
        self.enforce_rate_limit("autocomplete")?;
        let json = self.request_autocomplete(api_key, &payload).await?;
        Ok(map_autocomplete_response(
            json,
            payload.session_token.clone(),
        ))
    }

    pub async fn place_details(
        &self,
        payload: PlaceDetailsPayload,
    ) -> Result<PlaceDetailsResponse, IpcError> {
        let api_key = self.api_key()?;
        self.enforce_rate_limit("place_details")?;
        let json = self.request_place_details(api_key, &payload).await?;
        Ok(map_place_details_response(json))
    }
}

struct RateLimiter {
    soft_window: VecDeque<Instant>,
    burst_window: VecDeque<Instant>,
}

struct RateLimitNotice {
    user_message: &'static str,
    log_reason: &'static str,
}

impl RateLimiter {
    fn new() -> Self {
        Self {
            soft_window: VecDeque::new(),
            burst_window: VecDeque::new(),
        }
    }

    fn try_acquire(&mut self, now: Instant) -> Result<(), RateLimitNotice> {
        trim_window(&mut self.soft_window, SOFT_WINDOW_DURATION, now);
        trim_window(&mut self.burst_window, BURST_WINDOW_DURATION, now);

        if self.soft_window.len() >= SOFT_WINDOW_MAX_REQUESTS {
            return Err(RateLimitNotice {
                user_message: "Address suggestions are temporarily rate limited. Please wait a moment and retry.",
                log_reason: "per-second quota exceeded",
            });
        }

        if self.burst_window.len() >= BURST_WINDOW_MAX_REQUESTS {
            return Err(RateLimitNotice {
                user_message: "Address suggestions quota was reached. Retry in about a minute or reduce rapid lookups.",
                log_reason: "per-minute quota exceeded",
            });
        }

        self.soft_window.push_back(now);
        self.burst_window.push_back(now);
        Ok(())
    }
}

fn trim_window(window: &mut VecDeque<Instant>, duration: Duration, now: Instant) {
    while let Some(&timestamp) = window.front() {
        if now.duration_since(timestamp) > duration {
            window.pop_front();
        } else {
            break;
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlacesAutocompletePayload {
    pub query: String,
    #[serde(default)]
    pub session_token: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub country_bias: Option<Vec<String>>,
    #[serde(default)]
    pub location_bias: Option<LocationBiasPayload>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocationBiasPayload {
    pub latitude: f64,
    pub longitude: f64,
    pub radius_meters: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaceDetailsPayload {
    #[serde(default)]
    pub place_id: Option<String>,
    #[serde(default)]
    pub resource_name: Option<String>,
    #[serde(default)]
    pub session_token: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlacesAutocompleteResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_token: Option<String>,
    pub suggestions: Vec<AddressSuggestionDto>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddressSuggestionDto {
    pub id: String,
    pub primary_text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub secondary_text: Option<String>,
    pub structured: StructuredSuggestionDto,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resource_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub types: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub distance_meters: Option<f64>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AddressComponentsDto {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub street_number: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub route: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locality: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub administrative_area_level_1: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub administrative_area_level_2: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub postal_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub country_code: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StructuredSuggestionDto {
    #[serde(flatten)]
    pub components: AddressComponentsDto,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formatted_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub place_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resource_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<LocationDto>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub types: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocationDto {
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaceDetailsResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub place: Option<PlaceDetailsDto>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaceDetailsDto {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resource_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub formatted_address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
    pub components: AddressComponentsDto,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub location: Option<LocationDto>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub international_phone_number: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub national_phone_number: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub types: Option<Vec<String>>,
}

#[tauri::command]
pub async fn places_autocomplete(
    state: State<'_, GooglePlacesService>,
    payload: PlacesAutocompletePayload,
) -> Result<PlacesAutocompleteResponse, IpcError> {
    state.autocomplete(payload).await
}

#[tauri::command]
pub async fn places_resolve_details(
    state: State<'_, GooglePlacesService>,
    payload: PlaceDetailsPayload,
) -> Result<PlaceDetailsResponse, IpcError> {
    state.place_details(payload).await
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GoogleAutocompleteRequest {
    input: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    session_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    language_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    included_region_codes: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    location_bias: Option<LocationBiasCircle>,
}

impl GoogleAutocompleteRequest {
    fn from_payload(payload: &PlacesAutocompletePayload) -> Self {
        let session_token = payload.session_token.clone();
        let language_code = payload.language.clone().or_else(|| Some("en".to_string()));

        let included_region_codes = payload.country_bias.as_ref().map(|codes| {
            codes
                .iter()
                .filter_map(|code| {
                    let trimmed = code.trim();
                    if trimmed.is_empty() {
                        None
                    } else {
                        Some(trimmed.to_uppercase())
                    }
                })
                .collect::<Vec<_>>()
        });

        let location_bias = payload
            .location_bias
            .as_ref()
            .map(|bias| LocationBiasCircle {
                circle: LocationBiasCircleInner {
                    center: LocationCenter {
                        latitude: bias.latitude,
                        longitude: bias.longitude,
                    },
                    radius: bias.radius_meters,
                },
            });

        Self {
            input: payload.query.trim().to_string(),
            session_token,
            language_code,
            included_region_codes,
            location_bias,
        }
    }
}

#[derive(Serialize)]
struct LocationBiasCircle {
    circle: LocationBiasCircleInner,
}

#[derive(Serialize)]
struct LocationBiasCircleInner {
    center: LocationCenter,
    radius: f64,
}

#[derive(Serialize)]
struct LocationCenter {
    latitude: f64,
    longitude: f64,
}

fn map_autocomplete_response(
    json: Value,
    session_token_hint: Option<String>,
) -> PlacesAutocompleteResponse {
    let session_token = json
        .get("sessionToken")
        .and_then(|value| value.as_str().map(|s| s.to_string()))
        .or(session_token_hint);

    let suggestions_source = json
        .get("suggestions")
        .and_then(|value| value.as_array().cloned())
        .or_else(|| {
            json.get("places")
                .and_then(|value| value.as_array().cloned())
        })
        .unwrap_or_default();

    let suggestions = suggestions_source
        .into_iter()
        .filter_map(|entry| map_suggestion_entry(&entry))
        .collect::<Vec<_>>();

    PlacesAutocompleteResponse {
        session_token,
        suggestions,
    }
}

fn map_suggestion_entry(entry: &Value) -> Option<AddressSuggestionDto> {
    let prediction = entry
        .get("placePrediction")
        .and_then(|value| value.as_object())
        .cloned()
        .unwrap_or_else(|| entry.as_object().cloned().unwrap_or_default());

    if prediction.is_empty() {
        return None;
    }

    let prediction = Value::Object(prediction);

    let place_id = get_string(&prediction, &["placeId"]).map(|s| s.to_string());

    let raw_resource = get_string(&prediction, &["place"]).map(|s| s.to_string());
    let resource_name = raw_resource.clone().or_else(|| {
        place_id.as_ref().map(|id| {
            if id.starts_with("places/") {
                id.clone()
            } else {
                format!("places/{id}")
            }
        })
    });

    if place_id.is_none() && resource_name.is_none() {
        return None;
    }

    let components = collect_address_components(prediction.get("addressComponents"));

    let structured = StructuredSuggestionDto {
        components,
        formatted_address: get_string(&prediction, &["text", "text"])
            .or_else(|| get_string(&prediction, &["shortFormattedAddress"]))
            .or_else(|| get_string(&prediction, &["formattedAddress"]))
            .map(|s| s.to_string()),
        place_id: place_id.clone(),
        resource_name: resource_name.clone(),
        display_name: get_string(&prediction, &["structuredFormat", "mainText", "text"])
            .or_else(|| get_string(&prediction, &["displayName", "text"]))
            .map(|s| s.to_string()),
        location: prediction
            .get("location")
            .and_then(|value| parse_location(value)),
        types: to_string_vec(prediction.get("types")),
    };

    let primary_text = get_string(&prediction, &["structuredFormat", "mainText", "text"])
        .or_else(|| get_string(&prediction, &["text", "text"]))
        .or_else(|| structured.display_name.as_deref())
        .or_else(|| structured.formatted_address.as_deref())
        .unwrap_or("")
        .to_string();

    if primary_text.trim().is_empty() {
        return None;
    }

    let secondary_text = get_string(&prediction, &["structuredFormat", "secondaryText", "text"])
        .or_else(|| get_string(&prediction, &["text", "secondaryText"]))
        .map(|s| s.to_string())
        .or_else(|| build_secondary_text(&structured.components));

    let types = structured.types.clone();
    let distance_meters = prediction
        .get("distanceMeters")
        .and_then(|value| value.as_f64().or_else(|| value.as_i64().map(|v| v as f64)));

    Some(AddressSuggestionDto {
        id: place_id
            .clone()
            .or(resource_name.clone())
            .unwrap_or_else(|| primary_text.clone()),
        primary_text,
        secondary_text,
        structured,
        resource_name,
        types,
        distance_meters,
    })
}

fn map_place_details_response(json: Value) -> PlaceDetailsResponse {
    let place_value = json.get("place").unwrap_or(&json);
    if !place_value.is_object() {
        return PlaceDetailsResponse { place: None };
    }

    let components = collect_address_components(place_value.get("addressComponents"));

    let place = PlaceDetailsDto {
        id: get_string(place_value, &["id"]).map(|s| s.to_string()),
        resource_name: get_string(place_value, &["resourceName"])
            .or_else(|| get_string(place_value, &["name"]))
            .map(|s| s.to_string()),
        formatted_address: get_string(place_value, &["formattedAddress"])
            .or_else(|| get_string(place_value, &["shortFormattedAddress"]))
            .map(|s| s.to_string()),
        display_name: get_string(place_value, &["displayName", "text"]).map(|s| s.to_string()),
        components,
        location: place_value
            .get("location")
            .and_then(|value| parse_location(value)),
        international_phone_number: get_string(place_value, &["internationalPhoneNumber"])
            .map(|s| s.to_string()),
        national_phone_number: get_string(place_value, &["nationalPhoneNumber"])
            .map(|s| s.to_string()),
        types: to_string_vec(place_value.get("types")),
    };

    PlaceDetailsResponse { place: Some(place) }
}

fn get_string<'a>(value: &'a Value, path: &[&str]) -> Option<&'a str> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    current.as_str()
}

fn to_string_vec(value: Option<&Value>) -> Option<Vec<String>> {
    let array = value?.as_array()?;
    let items = array
        .iter()
        .filter_map(|entry| entry.as_str().map(|s| s.to_string()))
        .collect::<Vec<_>>();
    if items.is_empty() { None } else { Some(items) }
}

fn parse_location(value: &Value) -> Option<LocationDto> {
    let latitude = value.get("latitude")?.as_f64()?;
    let longitude = value.get("longitude")?.as_f64()?;
    Some(LocationDto {
        latitude,
        longitude,
    })
}

fn collect_address_components(value: Option<&Value>) -> AddressComponentsDto {
    let mut components = AddressComponentsDto::default();

    let Some(array) = value.and_then(|v| v.as_array()) else {
        return components;
    };

    for entry in array {
        let Some(object) = entry.as_object() else {
            continue;
        };
        let types = object
            .get("types")
            .and_then(|value| value.as_array())
            .map(|values| {
                values
                    .iter()
                    .filter_map(|item| item.as_str())
                    .map(|s| s.to_string())
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        let short_text = object
            .get("shortText")
            .and_then(|v| v.as_str())
            .or_else(|| object.get("short_name").and_then(|v| v.as_str()))
            .or_else(|| object.get("shortName").and_then(|v| v.as_str()));

        let long_text = object
            .get("longText")
            .and_then(|v| v.as_str())
            .or_else(|| object.get("long_name").and_then(|v| v.as_str()))
            .or_else(|| object.get("longName").and_then(|v| v.as_str()));

        for type_name in types {
            match type_name.as_str() {
                "street_number" => {
                    assign_if_empty(&mut components.street_number, long_text.or(short_text))
                }
                "route" => assign_if_empty(&mut components.route, long_text.or(short_text)),
                "locality" => assign_if_empty(&mut components.locality, long_text.or(short_text)),
                "administrative_area_level_1" => assign_if_empty(
                    &mut components.administrative_area_level_1,
                    long_text.or(short_text),
                ),
                "administrative_area_level_2" => assign_if_empty(
                    &mut components.administrative_area_level_2,
                    long_text.or(short_text),
                ),
                "postal_code" => {
                    assign_if_empty(&mut components.postal_code, short_text.or(long_text))
                }
                "country" => {
                    assign_if_empty(&mut components.country, long_text.or(short_text));
                    if let Some(short) = short_text {
                        components.country_code = Some(short.to_string());
                    } else {
                        assign_if_empty(&mut components.country_code, long_text);
                    }
                }
                _ => {}
            }
        }
    }

    components
}

fn build_secondary_text(components: &AddressComponentsDto) -> Option<String> {
    let mut parts = Vec::new();

    if let Some(locality) = components
        .locality
        .as_deref()
        .filter(|value| !value.is_empty())
    {
        parts.push(locality);
    }

    if let Some(region) = components
        .administrative_area_level_1
        .as_deref()
        .filter(|value| !value.is_empty())
    {
        parts.push(region);
    }

    if let Some(country) = components
        .country_code
        .as_deref()
        .or(components.country.as_deref())
        .filter(|value| !value.is_empty())
    {
        parts.push(country);
    }

    if parts.is_empty() {
        None
    } else {
        Some(parts.join(", "))
    }
}

fn assign_if_empty(target: &mut Option<String>, value: Option<&str>) {
    if target.is_none() {
        if let Some(text) = value {
            *target = Some(text.to_string());
        }
    }
}

fn handle_google_error(endpoint: &str, status: StatusCode, body: &str) -> IpcError {
    let message = extract_google_error_message(body);
    let fallback = match status {
        StatusCode::BAD_REQUEST | StatusCode::UNPROCESSABLE_ENTITY => {
            "Google Places rejected the request. Adjust your input and try again."
        }
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
            "Google Places API rejected the request. Verify your API key configuration."
        }
        StatusCode::TOO_MANY_REQUESTS => {
            "Too many requests were sent to Google Places. Wait a moment and retry."
        }
        StatusCode::SERVICE_UNAVAILABLE | StatusCode::GATEWAY_TIMEOUT => {
            "Google Places service is temporarily unavailable. Retry shortly."
        }
        _ => {
            "Unable to fetch address information from Google Places. Check your connection and retry."
        }
    };

    let user_message = message.unwrap_or_else(|| fallback.to_string());
    error!(
        "Google Places {endpoint} error (status={}): body={}",
        status.as_u16(),
        body
    );

    if matches!(
        status,
        StatusCode::BAD_REQUEST | StatusCode::UNPROCESSABLE_ENTITY
    ) {
        IpcError::Validation(user_message)
    } else {
        IpcError::Internal(user_message)
    }
}

fn extract_google_error_message(body: &str) -> Option<String> {
    #[derive(Deserialize)]
    struct ErrorDetail {
        message: Option<String>,
    }

    #[derive(Deserialize)]
    struct ErrorEnvelope {
        error: Option<ErrorDetail>,
    }

    serde_json::from_str::<ErrorEnvelope>(body)
        .ok()
        .and_then(|envelope| envelope.error.and_then(|err| err.message))
        .filter(|message| !message.trim().is_empty())
}

fn map_transport_error(context: &str, error: reqwest::Error) -> IpcError {
    error!("Google Places {context} failed: {error}");
    IpcError::Internal(
        "Unable to reach Google Places service. Check your connection and retry.".into(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn secondary_text_prefers_components() {
        let mut components = AddressComponentsDto::default();
        components.locality = Some("Brussels".into());
        components.administrative_area_level_1 = Some("Brussels Capital".into());
        components.country_code = Some("BE".into());

        let text = build_secondary_text(&components);
        assert_eq!(text, Some("Brussels, Brussels Capital, BE".into()));
    }

    #[test]
    fn collect_components_extracts_country() {
        let value = json!([
            {
                "types": ["country"],
                "shortText": "BE",
                "longText": "Belgium"
            }
        ]);

        let components = collect_address_components(Some(&value));
        assert_eq!(components.country.as_deref(), Some("Belgium"));
        assert_eq!(components.country_code.as_deref(), Some("BE"));
    }

    #[test]
    fn map_autocomplete_response_populates_suggestion() {
        let json_value = json!({
            "sessionToken": "abc-token",
            "suggestions": [
                {
                    "placePrediction": {
                        "placeId": "ChIJ123456",
                        "structuredFormat": {
                            "mainText": { "text": "Example HQ" },
                            "secondaryText": { "text": "Brussels, Belgium" }
                        },
                        "text": {
                            "text": "Example HQ, Brussels, Belgium",
                            "secondaryText": "Belgium"
                        },
                        "addressComponents": [
                            { "types": ["street_number"], "longText": "1" },
                            { "types": ["route"], "longText": "Rue Example" },
                            { "types": ["locality"], "longText": "Brussels" },
                            { "types": ["country"], "shortText": "BE", "longText": "Belgium" }
                        ],
                        "location": { "latitude": 50.1, "longitude": 4.21 },
                        "types": ["street_address"],
                        "distanceMeters": 145.0
                    }
                }
            ]
        });

        let response = map_autocomplete_response(json_value, Some("hint-token".into()));
        assert_eq!(response.session_token.as_deref(), Some("abc-token"));
        assert_eq!(response.suggestions.len(), 1);

        let suggestion = &response.suggestions[0];
        assert_eq!(suggestion.id, "ChIJ123456");
        assert_eq!(suggestion.primary_text, "Example HQ");
        assert_eq!(
            suggestion.secondary_text.as_deref(),
            Some("Brussels, Belgium")
        );
        assert_eq!(
            suggestion.structured.components.locality.as_deref(),
            Some("Brussels")
        );
        assert_eq!(
            suggestion.structured.place_id.as_deref(),
            Some("ChIJ123456")
        );
        assert!(
            suggestion
                .resource_name
                .as_deref()
                .is_some_and(|value| value.starts_with("places/"))
        );
        assert_eq!(
            suggestion
                .structured
                .location
                .as_ref()
                .map(|loc| (loc.latitude, loc.longitude)),
            Some((50.1, 4.21))
        );
        assert_eq!(suggestion.distance_meters, Some(145.0));
    }

    #[test]
    fn map_place_details_response_maps_fields() {
        let json_value = json!({
            "place": {
                "id": "ChIJ123456",
                "resourceName": "places/ChIJ123456",
                "formattedAddress": "Example HQ, Brussels, Belgium",
                "displayName": { "text": "Example HQ" },
                "addressComponents": [
                    { "types": ["locality"], "longText": "Brussels" },
                    { "types": ["country"], "shortText": "BE", "longText": "Belgium" }
                ],
                "types": ["street_address"],
                "location": { "latitude": 50.1, "longitude": 4.21 }
            }
        });

        let response = map_place_details_response(json_value);
        let place = response.place.expect("expected place payload");

        assert_eq!(
            place.formatted_address.as_deref(),
            Some("Example HQ, Brussels, Belgium")
        );
        assert_eq!(place.display_name.as_deref(), Some("Example HQ"));
        assert_eq!(place.components.locality.as_deref(), Some("Brussels"));
        assert_eq!(place.components.country_code.as_deref(), Some("BE"));
        assert_eq!(place.types, Some(vec!["street_address".into()]));
        assert_eq!(
            place
                .location
                .as_ref()
                .map(|loc| (loc.latitude, loc.longitude)),
            Some((50.1, 4.21))
        );
    }

    #[test]
    fn rate_limiter_blocks_soft_window_bursts() {
        let mut limiter = RateLimiter::new();
        let start = Instant::now();
        for offset in 0..SOFT_WINDOW_MAX_REQUESTS {
            let now = start + Duration::from_millis(offset as u64 * 50);
            assert!(limiter.try_acquire(now).is_ok());
        }
        let burst = start + Duration::from_millis(200);
        let result = limiter.try_acquire(burst);
        assert!(result.is_err());
    }

    #[test]
    fn rate_limiter_allows_after_window_elapses() {
        let mut limiter = RateLimiter::new();
        let start = Instant::now();
        for offset in 0..SOFT_WINDOW_MAX_REQUESTS {
            let now = start + Duration::from_millis(offset as u64 * 50);
            assert!(limiter.try_acquire(now).is_ok());
        }
        let later = start + SOFT_WINDOW_DURATION + Duration::from_millis(10);
        assert!(limiter.try_acquire(later).is_ok());
    }
}
