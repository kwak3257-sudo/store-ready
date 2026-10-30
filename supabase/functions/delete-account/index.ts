// Supabase Edge Function: deletes the caller's account and everything stored for it.
// App stores require that an account made in the app can also be deleted from the app.
// Tables that reference auth.users are removed by "on delete cascade"; screenshot files are removed here first.
//   supabase functions deploy delete-account

import { withSupabase } from '@supabase/server';

const BUCKET = 'screenshots';

function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'POST만 지원합니다.' }, 405);
    const userId = ctx.userClaims?.id;
    if (!userId) return json({ error: '로그인이 필요합니다.' }, 401);

    const storage = ctx.supabaseAdmin.storage.from(BUCKET);
    // list() returns at most `limit` entries, so keep going until the folder is empty.
    for (;;) {
      const { data: files, error } = await storage.list(userId, { limit: 1000 });
      if (error) {
        console.error('listing screenshots failed', error);
        return json({ error: '저장된 사진을 지우지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 500);
      }
      if (!files?.length) break;
      const { error: removeError } = await storage.remove(files.map((f) => `${userId}/${f.name}`));
      if (removeError) {
        console.error('removing screenshots failed', removeError);
        return json({ error: '저장된 사진을 지우지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 500);
      }
    }

    const { error } = await ctx.supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      console.error('deleting user failed', error);
      return json({ error: '계정을 지우지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 500);
    }
    return json({ deleted: true });
  }),
};
