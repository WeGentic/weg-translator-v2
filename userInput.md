NOTE: THE TAURI APP CANNOT BUNDLE ANY API key. Admin functions WILL BE DONE BY SPECIALISED EDGE functions in Supabase
•	❌ Don’t put the service role key in your PWA (or any frontend). Ever.  ￼
•	❌ Don’t ship tables without RLS enabled & tested.  ￼
•	❌ Don’t cache API responses that contain user data or tokens in the service worker.  ￼
•	❌ Don’t rely on client-side checks in place of policies/Edge Functions.

1. Config new supabase project

VITE_SUPABASE_URL=https://wnohgxkujwnuoqtibsss.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indub2hneGt1andudW9xdGlic3NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MjczNTQsImV4cCI6MjA2NzMwMzM1NH0.l1ZycvPrUCGVXo_0Y7uyS8ecJafKKi-zD0y2H9xjkFI

import { createClient } from '@supabase/supabase-js';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
export default supabase

import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'

2. Provide a SQL script to create the schema (ONLY USER BY Developers - NOT INCLUDED IN THE APP)
    
    User Schema
    
    Company UUID
    Company name
    Company address (split according to Google Place Api output)
    Company TaxID
    Company email
    Company phone
    
    Admin UUID
    Admin Email
    
    EmailVerified: default FALSE
    PhoneVerified: default FALSE
    AccountApproved: default FALSE
    
    AccountType: (to be implemented)
    Subscription: (to be implemented)

3. Implement the Registration flow, with supabase
        a. Create user (User can't silently or directly login until email is verified). If creation fails notify che user with details about the error
        b. Display an Email Verification Confirmation Dialog which check every x time the verification status and which has a button "I have verified the email" (that trigger verification manually)
        c. When email is verified, silently log
        d. If log is successful, store Registration data in the Schema above
        e. Data is stored successfully? YES -> Proceed to Dashboard, NO -> Notify the user and Rollback
