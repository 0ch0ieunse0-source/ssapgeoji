/**
 * 친구 랭킹 서버 (Supabase). 두 값이 비어 있으면 랭킹 기능이 안 보여요.
 * anon key는 공개용 키예요. 서버 규칙(supabase/ranking.sql)으로 정해진 함수만 쓸 수 있어요.
 */
export const SUPABASE_URL = "https://twgsogcptjkodauoojos.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_P9Pha7fqBo7o9WKYV1Oh6w_J0v-NGiC";
export const rankEnabled = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
