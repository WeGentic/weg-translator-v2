import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

export interface AutocompleteRequest {
  mode: "autocomplete" | "place-details";
  query?: string;
  placeId?: string;
  sessionToken?: string;
  languageCode?: string;
  countryBias?: string[];
  locationBias?: {
    latitude: number;
    longitude: number;
    radiusMeters: number;
  };
}

export interface ErrorPayload {
  error: {
    code: string;
    message: string;
  };
}

interface AutocompleteResponse {
  sessionToken: string | null;
  suggestions: unknown[];
}

interface PlaceDetailsResponse {
  place: unknown;
}

const GOOGLE_AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const GOOGLE_PLACE_DETAILS_URL = "https://places.googleapis.com/v1";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const fieldMaskAutocomplete = [
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.place",
  "suggestions.placePrediction.structuredFormat",
  "suggestions.placePrediction.text",
  "suggestions.placePrediction.types",
  "suggestions.placePrediction.distanceMeters",
];

const fieldMaskDetails = [
  "id",
  "name",
  "formattedAddress",
  "displayName",
  "types",
  "addressComponents",
  "location",
  "internationalPhoneNumber",
  "nationalPhoneNumber",
];

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...CORS_HEADERS,
      },
    });
  }

  if (req.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
      },
    });
  }

  if (req.method === "GET") {
    return jsonResponse({ status: "ok" });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: { code: "method_not_allowed", message: "Only POST supported" },
      },
      405,
    );
  }

  let payload: AutocompleteRequest;
  try {
    payload = await req.json();
  } catch (_) {
    return jsonResponse(
      {
        error: {
          code: "invalid_json",
          message: "Request body must be valid JSON",
        },
      },
      400,
    );
  }

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    return jsonResponse(
      {
        error: {
          code: "missing_secret",
          message: "GOOGLE_MAPS_API_KEY is not configured",
        },
      },
      500,
    );
  }

  const validationError = validateRequest(payload);
  if (validationError) {
    return jsonResponse(validationError, 400);
  }

  try {
    if (payload.mode === "autocomplete") {
      const response = await callAutocomplete(apiKey, payload);
      return jsonResponse(response, 200);
    }

    const response = await callPlaceDetails(apiKey, payload);
    return jsonResponse(response, 200);
  } catch (error) {
    console.error("address-autocomplete error", error);
    return jsonResponse(
      {
        error: {
          code: "upstream_error",
          message: error instanceof Error ? error.message : "Unexpected upstream error",
        },
      },
      502,
    );
  }
}

if (import.meta.main) {
  serve(handleRequest);
}

export function validateRequest(payload: AutocompleteRequest): ErrorPayload | undefined {
  if (!payload || !payload.mode) {
    return {
      error: { code: "invalid_request", message: "'mode' is required" },
    };
  }

  if (!["autocomplete", "place-details"].includes(payload.mode)) {
    return {
      error: {
        code: "invalid_request",
        message: "'mode' must be 'autocomplete' or 'place-details'",
      },
    };
  }

  if (payload.mode === "autocomplete") {
    if (!payload.query || payload.query.trim().length < 2) {
      return {
        error: {
          code: "invalid_request",
          message: "'query' must be at least 2 characters for autocomplete",
        },
      };
    }
  }

  if (payload.mode === "place-details") {
    if (!payload.placeId) {
      return {
        error: {
          code: "invalid_request",
          message: "'placeId' is required for place-details",
        },
      };
    }
  }

  if (payload.countryBias && payload.countryBias.length > 5) {
    return {
      error: {
        code: "invalid_request",
        message: "'countryBias' accepts up to 5 country codes",
      },
    };
  }

  if (payload.locationBias) {
    const { latitude, longitude, radiusMeters } = payload.locationBias;
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      typeof radiusMeters !== "number"
    ) {
      return {
        error: {
          code: "invalid_request",
          message: "'locationBias' requires numeric latitude, longitude, and radiusMeters",
        },
      };
    }
  }

  return undefined;
}

async function callAutocomplete(apiKey: string, payload: AutocompleteRequest): Promise<AutocompleteResponse> {
  const body: Record<string, unknown> = {
    input: payload.query,
    sessionToken: payload.sessionToken,
    languageCode: payload.languageCode ?? "en",
  };

  if (payload.locationBias) {
    body["locationBias"] = {
      circle: {
        center: {
          latitude: payload.locationBias.latitude,
          longitude: payload.locationBias.longitude,
        },
        radius: payload.locationBias.radiusMeters,
      },
    };
  }

  if (payload.countryBias && payload.countryBias.length > 0) {
    body["includedRegionCodes"] = payload.countryBias;
  }

  const response = await fetch(GOOGLE_AUTOCOMPLETE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMaskAutocomplete.join(","),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google autocomplete error ${response.status}: ${text}`);
  }

  const json = await response.json();
  return mapAutocompleteResponse(json);
}

async function callPlaceDetails(apiKey: string, payload: AutocompleteRequest): Promise<PlaceDetailsResponse> {
  const placeId = payload.placeId!;
  const resourceName = placeId.startsWith("places/") ? placeId : `places/${placeId}`;
  const response = await fetch(`${GOOGLE_PLACE_DETAILS_URL}/${resourceName}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMaskDetails.join(","),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google place details error ${response.status}: ${text}`);
  }

  const json = await response.json();
  return mapPlaceDetailsResponse(json);
}

export function mapAutocompleteResponse(googleData: Record<string, unknown>): AutocompleteResponse {
  const data = googleData as Record<string, any>;
  const suggestions = Array.isArray(data?.suggestions)
    ? data.suggestions
    : Array.isArray(data?.places)
    ? data.places
    : [];

  return {
    sessionToken: (data?.sessionToken as string | null | undefined) ?? null,
    suggestions: suggestions
      .map((entry: unknown) => {
        const prediction = (entry as Record<string, any>)?.placePrediction ?? entry;
        if (!prediction || typeof prediction !== "object") {
          return null;
        }

        const structuredPrediction = prediction as Record<string, any>;
        const components = collectAddressComponents(structuredPrediction.addressComponents);

        const primaryText =
          structuredPrediction?.structuredFormat?.mainText?.text ??
          structuredPrediction?.text?.text ??
          structuredPrediction?.displayName?.text ??
          structuredPrediction?.shortFormattedAddress ??
          structuredPrediction?.formattedAddress ??
          "";

        const secondaryText =
          structuredPrediction?.structuredFormat?.secondaryText?.text ??
          structuredPrediction?.text?.secondaryText ??
          buildSecondaryText(components) ??
          null;

        const location = structuredPrediction.location
          ? {
              latitude: structuredPrediction.location.latitude,
              longitude: structuredPrediction.location.longitude,
            }
          : null;

        const placeId = structuredPrediction.placeId ?? structuredPrediction.id ?? null;
        const resourceName =
          structuredPrediction.place ??
          (placeId ? `places/${placeId}` : null);
        if (!placeId && !resourceName) {
          return null;
        }

        const structured: Record<string, unknown> = { ...components };
        if (placeId) structured.placeId = placeId;
        if (resourceName) structured.resourceName = resourceName;

        const formattedCandidate =
          structuredPrediction?.text?.text ??
          structuredPrediction?.shortFormattedAddress ??
          structuredPrediction?.formattedAddress ??
          null;
        if (formattedCandidate) {
          structured.formattedAddress = formattedCandidate;
        }
        const displayName =
          structuredPrediction?.structuredFormat?.mainText?.text ??
          structuredPrediction?.displayName?.text ??
          null;
        if (displayName) {
          structured.displayName = displayName;
        }
        if (location) {
          structured.location = location;
        }
        if (Array.isArray(structuredPrediction.types) && structuredPrediction.types.length) {
          structured.types = structuredPrediction.types;
        }

        return {
          id: placeId ?? resourceName!,
          primaryText,
          secondaryText,
          structured,
          location,
          types: structuredPrediction.types ?? [],
          distanceMeters: structuredPrediction.distanceMeters ?? null,
          resourceName,
        };
      })
      .filter(Boolean),
  };
}

export function mapPlaceDetailsResponse(googleData: Record<string, unknown>): PlaceDetailsResponse {
  const data = googleData as Record<string, any>;
  const components = collectAddressComponents(data.addressComponents);
  return {
    place: {
      id: data.id,
      resourceName: data.resourceName ?? data.name ?? null,
      formattedAddress:
        data.formattedAddress ??
        data.shortFormattedAddress ??
        null,
      displayName: data.displayName?.text ?? null,
      components,
      location: data.location
        ? {
            latitude: data.location.latitude,
            longitude: data.location.longitude,
          }
        : null,
      internationalPhoneNumber: data.internationalPhoneNumber ?? null,
      nationalPhoneNumber: data.nationalPhoneNumber ?? null,
      types: Array.isArray(data.types) ? data.types : null,
    },
  };
}

export function collectAddressComponents(components: unknown = []): Record<string, string | null> {
  const result: Record<string, string | null> = {
    streetNumber: null,
    route: null,
    locality: null,
    administrativeAreaLevel1: null,
    administrativeAreaLevel2: null,
    postalCode: null,
    country: null,
    countryCode: null,
  };

  if (!Array.isArray(components)) {
    return result;
  }

  for (const entry of components) {
    const component = entry as Record<string, any>;
    const types = Array.isArray(component.types) ? component.types : [];
    const shortText = (component.shortText ?? component.short_name) as string | null | undefined;
    const longText = (component.longText ?? component.long_name) as string | null | undefined;

    if (types.includes("street_number")) {
      result.streetNumber = longText ?? shortText ?? result.streetNumber;
    }
    if (types.includes("route")) {
      result.route = longText ?? shortText ?? result.route;
    }
    if (types.includes("locality")) {
      result.locality = longText ?? shortText ?? result.locality;
    }
    if (types.includes("administrative_area_level_1")) {
      result.administrativeAreaLevel1 = longText ?? shortText ?? result.administrativeAreaLevel1;
    }
    if (types.includes("administrative_area_level_2")) {
      result.administrativeAreaLevel2 = longText ?? shortText ?? result.administrativeAreaLevel2;
    }
    if (types.includes("postal_code")) {
      result.postalCode = shortText ?? longText ?? result.postalCode;
    }
    if (types.includes("country")) {
      result.country = longText ?? shortText ?? result.country;
      result.countryCode = shortText ?? result.countryCode;
    }
  }

  return result;
}

export function buildSecondaryText(components: Record<string, string | null>): string | null {
  const parts = [
    components.locality,
    components.administrativeAreaLevel1,
    components.countryCode ?? components.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : null;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
    },
  });
}
