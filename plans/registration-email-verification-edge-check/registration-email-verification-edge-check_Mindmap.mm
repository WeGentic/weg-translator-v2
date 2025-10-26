<map version="1.0.1">
  <node TEXT="registration-email-verification-edge-check">
    <node TEXT="Requirements">
      <node TEXT="Req#1 Edge Function classification">
        <node TEXT="POST email payload, service-role lookup"/>
        <node TEXT="Return registered_verified / registered_unverified / not_registered"/>
      </node>
      <node TEXT="Req#2 Frontend probe UX">
        <node TEXT="Debounced hook, inline banner, accessible feedback"/>
      </node>
      <node TEXT="Req#3 Verified account actions">
        <node TEXT="Prompt login or recover password, block submission"/>
      </node>
      <node TEXT="Req#4 Unverified account support">
        <node TEXT="Reopen verification dialog, resend confirmation"/>
      </node>
    </node>
    <node TEXT="Design">
      <node TEXT="Edge Function">
        <node TEXT="Zod validation, correlation logging"/>
        <node TEXT="Rate limiting, structured errors"/>
      </node>
      <node TEXT="useEmailStatusProbe">
        <node TEXT="Debounce + AbortController"/>
        <node TEXT="State caching, telemetry hooks"/>
      </node>
      <node TEXT="UI Integration">
        <node TEXT="EmailStatusBanner in RegistrationAdminStep"/>
        <node TEXT="Verification dialog contextual messaging"/>
      </node>
      <node TEXT="Testing Strategy">
        <node TEXT="Deno tests, Vitest coverage, E2E regression"/>
      </node>
    </node>
    <node TEXT="Tasks">
      <node TEXT="1 Edge Function implementation"/>
      <node TEXT="2 Function observability & rate limits"/>
      <node TEXT="3 Hook creation & tests"/>
      <node TEXT="4 Form integration & UX blocking"/>
      <node TEXT="5 Unverified flow enhancements"/>
      <node TEXT="6 UX & analytics polish"/>
      <node TEXT="7 Validation & release prep"/>
    </node>
  </node>
</map>
