import { safeInvoke } from "./request";

export interface AddressComponents {
  streetNumber?: string;
  route?: string;
  locality?: string;
  administrativeAreaLevel1?: string;
  administrativeAreaLevel2?: string;
  postalCode?: string;
  country?: string;
  countryCode?: string;
}

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface StructuredSuggestion {
  components: AddressComponents;
  formattedAddress?: string;
  placeId?: string;
  resourceName?: string;
  displayName?: string;
  location?: LocationCoordinates;
  types?: string[];
}

export interface AddressSuggestion {
  id: string;
  primaryText: string;
  secondaryText?: string;
  structured?: StructuredSuggestion;
  resourceName?: string;
  types?: string[];
  distanceMeters?: number;
}

export interface PlaceDetails {
  id?: string;
  resourceName?: string;
  formattedAddress?: string;
  displayName?: string;
  components: AddressComponents;
  location?: LocationCoordinates;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  types?: string[];
}

export interface LocationBias {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface AutocompleteRequest {
  query: string;
  sessionToken?: string;
  language?: string;
  countryBias?: readonly string[];
  locationBias?: LocationBias;
}

interface AutocompleteWireResponse {
  sessionToken?: string;
  suggestions: AddressSuggestion[];
}

export interface PlaceDetailsRequest {
  placeId?: string;
  resourceName?: string;
  sessionToken?: string;
}

interface PlaceDetailsWireResponse {
  place?: PlaceDetails;
}

export async function autocompleteAddress(
  request: AutocompleteRequest,
): Promise<AutocompleteWireResponse> {
  const payload = {
    query: request.query,
    sessionToken: request.sessionToken,
    language: request.language,
    countryBias:
      request.countryBias && request.countryBias.length > 0
        ? Array.from(request.countryBias)
        : undefined,
    locationBias: request.locationBias,
  };

  return safeInvoke<AutocompleteWireResponse>("places_autocomplete", { payload });
}

export async function resolveAddressDetails(
  request: PlaceDetailsRequest,
): Promise<PlaceDetails | null> {
  const payload = {
    placeId: request.placeId,
    resourceName: request.resourceName,
    sessionToken: request.sessionToken,
  };

  const response = await safeInvoke<PlaceDetailsWireResponse>("places_resolve_details", {
    payload,
  });

  return response.place ?? null;
}
