
-- Profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX profiles_username_idx ON public.profiles (lower(username));
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Conversations: 1-on-1, deterministic id from sorted user pair
CREATE TABLE public.conversations (
  id TEXT NOT NULL PRIMARY KEY,
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  last_sender_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_a < user_b)
);
CREATE INDEX conv_user_a_idx ON public.conversations(user_a, last_message_at DESC);
CREATE INDEX conv_user_b_idx ON public.conversations(user_b, last_message_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv_select_participants" ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "conv_insert_participants" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "conv_update_participants" ON public.conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- Messages
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_conv_idx ON public.messages(conversation_id, created_at);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_conv_participant(_conv TEXT, _uid UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conv AND (c.user_a = _uid OR c.user_b = _uid)
  );
$$;

CREATE POLICY "msg_select_participant" ON public.messages FOR SELECT TO authenticated
  USING (public.is_conv_participant(conversation_id, auth.uid()));
CREATE POLICY "msg_insert_sender" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND public.is_conv_participant(conversation_id, auth.uid()));

-- Trigger: auto-create profile from auth.users metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uname TEXT;
  dname TEXT;
  avatar TEXT;
BEGIN
  uname := COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8));
  dname := COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  avatar := NEW.raw_user_meta_data->>'avatar_url';
  -- Ensure uniqueness; if username taken, suffix random
  IF EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(uname)) THEN
    uname := uname || '_' || substr(NEW.id::text, 1, 4);
  END IF;
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (NEW.id, uname, dname, avatar);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: update conversation last_message on new message
CREATE OR REPLACE FUNCTION public.update_conv_on_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations
  SET last_message = NEW.text, last_message_at = NEW.created_at, last_sender_id = NEW.sender_id
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_message_inserted
AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.update_conv_on_message();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
