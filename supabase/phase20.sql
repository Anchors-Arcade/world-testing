ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_completed_tutorial boolean NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.set_tutorial_completed() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $
BEGIN
  UPDATE public.profiles SET has_completed_tutorial = TRUE WHERE id = auth.uid();
END $;

REVOKE ALL ON FUNCTION public.set_tutorial_completed() FROM PUBLIC, ANON;
GRANT EXECUTE ON FUNCTION public.set_tutorial_completed() TO AUTHENTICATED;