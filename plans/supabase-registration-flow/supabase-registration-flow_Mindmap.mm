<?xml version="1.0" encoding="UTF-8"?>
<map version="1.0.1">
  <node TEXT="supabase-registration-flow">
    <node TEXT="Objectives">
      <node TEXT="Verified Supabase onboarding"/>
      <node TEXT="Secure multi-tenant data"/>
      <node TEXT="Developer provisioning toolkit"/>
    </node>
    <node TEXT="Requirements">
      <node TEXT="Requirement 1: Verified sign-up">
        <node TEXT="SignUp error handling"/>
        <node TEXT="Verification dialog"/>
        <node TEXT="Polling & manual check"/>
      </node>
      <node TEXT="Requirement 2: Persist org/admin data">
        <node TEXT="Transactional Edge Function"/>
        <node TEXT="Rollback on failure"/>
        <node TEXT="Sync local profile"/>
      </node>
      <node TEXT="Requirement 3: Provisioning SQL">
        <node TEXT="Companies table"/>
        <node TEXT="Company admins table"/>
        <node TEXT="RLS policies"/>
      </node>
      <node TEXT="Requirement 4: Security compliance">
        <node TEXT="Anon key only in client"/>
        <node TEXT="Edge Function JWT checks"/>
        <node TEXT="No PII caching"/>
      </node>
    </node>
    <node TEXT="Design">
      <node TEXT="React Client">
        <node TEXT="useRegistrationSubmission"/>
        <node TEXT="VerificationDialog"/>
      </node>
      <node TEXT="Supabase Auth">
        <node TEXT="Email confirmation"/>
        <node TEXT="Session gating"/>
      </node>
      <node TEXT="Edge Function">
        <node TEXT="register_organization"/>
        <node TEXT="Structured errors"/>
      </node>
      <node TEXT="Database">
        <node TEXT="companies + company_admins"/>
        <node TEXT="RLS policies"/>
      </node>
      <node TEXT="Observability">
        <node TEXT="Correlation IDs"/>
        <node TEXT="Supabase logs"/>
      </node>
    </node>
    <node TEXT="Tasks">
      <node TEXT="1. Env setup"/>
      <node TEXT="2. SQL provisioning"/>
      <node TEXT="3. Edge function"/>
      <node TEXT="4. Submission hook"/>
      <node TEXT="5. Verification UI"/>
      <node TEXT="6. Persistence & sync"/>
      <node TEXT="7. Auth gating & logs"/>
      <node TEXT="8. Testing & QA"/>
    </node>
    <node TEXT="NFRs">
      <node TEXT="Security"/>
      <node TEXT="Reliability"/>
      <node TEXT="Usability"/>
      <node TEXT="Observability"/>
    </node>
  </node>
</map>
