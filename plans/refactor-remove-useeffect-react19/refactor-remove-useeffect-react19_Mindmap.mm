<map version="1.0.1">
  <node TEXT="refactor-remove-useeffect-react19">
    <node TEXT="Context & Goals">
      <node TEXT="Eliminate all useEffect usage"/>
      <node TEXT="Adopt React 19 primitives"/>
      <node TEXT="Preserve Supabase & Tauri workflows"/>
    </node>
    <node TEXT="Requirements">
      <node TEXT="Req#1 Core Providers">
        <node TEXT="LogProvider via event store"/>
        <node TEXT="AuthProvider resource-based session"/>
        <node TEXT="Shell readiness scheduler"/>
      </node>
      <node TEXT="Req#2 Data Resources">
        <node TEXT="Translation history resource"/>
        <node TEXT="Health polling scheduler"/>
        <node TEXT="Wizard/client data via cache"/>
      </node>
      <node TEXT="Req#3 Event & Media Stores">
        <node TEXT="Navigation bus"/>
        <node TEXT="Media query store"/>
        <node TEXT="File-drop wrapper"/>
      </node>
      <node TEXT="Req#4 Transitions">
        <node TEXT="State machine controller"/>
        <node TEXT="Router listener integration"/>
        <node TEXT="Diagnostics overlay"/>
      </node>
      <node TEXT="Req#5 Forms & Wizards">
        <node TEXT="Action-based auth forms"/>
        <node TEXT="Wizard resource flows"/>
        <node TEXT="Recovery dialogs"/>
      </node>
    </node>
    <node TEXT="Design Components">
      <node TEXT="createResource + selectors"/>
      <node TEXT="createEventStore (useSyncExternalStore)"/>
      <node TEXT="Scheduler for timers/polling"/>
      <node TEXT="TransitionStateController FSM"/>
      <node TEXT="FormActionSuite with useActionState"/>
    </node>
    <node TEXT="Implementation Phases">
      <node TEXT="Phase 1 Core Infrastructure">
        <node TEXT="Utilities & providers"/>
      </node>
      <node TEXT="Phase 2 Data & Events">
        <node TEXT="Resource migrations"/>
        <node TEXT="Event store adoption"/>
      </node>
      <node TEXT="Phase 3 Transitions & Forms">
        <node TEXT="Transition orchestrator"/>
        <node TEXT="Form action refactors"/>
        <node TEXT="Testing & rollout"/>
      </node>
    </node>
    <node TEXT="Key Tasks">
      <node TEXT="Implement resource/event utilities (Task 1)"/>
      <node TEXT="Refactor providers (Task 2)"/>
      <node TEXT="Migrate data hooks (Task 3)"/>
      <node TEXT="Replace subscriptions (Task 4)"/>
      <node TEXT="Rebuild transitions (Task 5)"/>
      <node TEXT="Refactor forms (Task 6)"/>
      <node TEXT="QA & documentation (Task 7)"/>
    </node>
    <node TEXT="Risks & Mitigations">
      <node TEXT="Regression scope → phased rollout"/>
      <node TEXT="Concurrency safety → useSyncExternalStore/tests"/>
      <node TEXT="API volatility → adapters"/>
    </node>
  </node>
</map>
