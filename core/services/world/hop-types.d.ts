export type Hop = {
  id: string;
  chat_id?: string;
  thread_ts?: string;
  kind?: string;
  from_role?: string;
  to_role?: string;
  state?: string | null;
  via?: string[];
  message_ids?: string[];
  created_at?: string | null;
  at?: string | null;
  note?: string;
  cause?: string;
  seq?: number | null;
};
