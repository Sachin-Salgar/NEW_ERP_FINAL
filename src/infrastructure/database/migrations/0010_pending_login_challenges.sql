CREATE TABLE public.pending_login_challenges (
  challenge_id uuid PRIMARY KEY,
  identity_id uuid NOT NULL REFERENCES public.identities(id),
  secret_hash varchar(64) NOT NULL UNIQUE,
  context_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  CONSTRAINT pending_login_challenges_expiry_check
    CHECK (expires_at > created_at),
  CONSTRAINT pending_login_challenges_consumed_check
    CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);
--> statement-breakpoint
CREATE INDEX pending_login_challenges_identity_expiry_idx
  ON public.pending_login_challenges (identity_id, expires_at);
--> statement-breakpoint
CREATE INDEX pending_login_challenges_unconsumed_expiry_idx
  ON public.pending_login_challenges (expires_at)
  WHERE consumed_at IS NULL;
--> statement-breakpoint
REVOKE ALL ON public.pending_login_challenges FROM PUBLIC;
--> statement-breakpoint
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.pending_login_challenges FROM erp_app;
--> statement-breakpoint
GRANT INSERT, SELECT, UPDATE ON public.pending_login_challenges TO erp_app;
