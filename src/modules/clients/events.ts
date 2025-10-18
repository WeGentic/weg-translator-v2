export const CLIENT_FOCUS_EVENT = "clients:focus";
export const CLIENT_CLEAR_EVENT = "clients:clear";

export interface ClientFocusDetail {
  clientUuid: string;
  clientName: string;
}

export function dispatchClientFocus(detail: ClientFocusDetail) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent<ClientFocusDetail>(CLIENT_FOCUS_EVENT, { detail }));
}

export function dispatchClientClear() {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(CLIENT_CLEAR_EVENT));
}
