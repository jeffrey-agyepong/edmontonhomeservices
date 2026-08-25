/// <reference types="astro/client" />

// Astro.locals is how middleware.ts hands the already-verified user
// (from supabase.auth.getUser()) to any page under /dashboard, without
// that page needing to re-run its own session check.
declare namespace App {
  interface Locals {
    user?: import('@supabase/supabase-js').User;
  }
}
