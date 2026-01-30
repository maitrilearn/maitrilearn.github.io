import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const supabase = createClient(
  "https://rairwoyaesgvezxyztnq.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhaXJ3b3lhZXNndmV6eHl6dG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NTIwODcsImV4cCI6MjA3NzEyODA4N30.1TxIpecWR2YoP_6wz-Ifs3VWWfuhLND5ob3pLYzJM_g"
);

