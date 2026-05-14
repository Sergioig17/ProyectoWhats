import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://vtgstpeqztqiqmaljtxh.supabase.co";
const supabasePublishableKey = "sb_publishable_NOrlCIcltYI0EVaUsTx_-w_KcZ9W3IL";
export const supabase = createClient(supabaseUrl, supabasePublishableKey);
